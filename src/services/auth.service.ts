import { User, type UserDoc } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { hashPassword, verifyPassword } from './password.service';
import {
  signAccessToken,
  generateOpaqueToken,
  hashOpaqueToken,
} from './token.service';
import { env } from '../config/env';
import { Types } from 'mongoose';

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Email already registered');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

// Deliberately generic — used for both "no such user" and "wrong password"
// so a client can't distinguish the two (see the blueprint's NoSQL
// injection / login section: don't give an attacker a account-existence
// oracle through error specificity).
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid or expired refresh token');
    this.name = 'InvalidRefreshTokenError';
  }
}

export class InvalidResetTokenError extends Error {
  constructor() {
    super('Invalid or expired reset token');
    this.name = 'InvalidResetTokenError';
  }
}

// Only ever built from named, server-controlled fields — never from a
// spread of a Mongoose document — so passwordHash can never leak into a
// response by accident even if `select: false` were ever removed later.
export interface PublicUser {
  id: string;
  email: string;
}

function toPublicUser(doc: UserDoc & { _id: Types.ObjectId }): PublicUser {
  return { id: doc._id.toString(), email: doc.email };
}

interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

async function issueRefreshToken(userId: Types.ObjectId, replaces?: Types.ObjectId): Promise<string> {
  const { raw, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const created = await RefreshToken.create({ userId, tokenHash: hash, expiresAt });
  if (replaces) {
    await RefreshToken.findByIdAndUpdate(replaces, { replacedBy: created._id });
  }
  return raw;
}

/**
 * Register a new user. Only `email` and a freshly-hashed `password` are
 * ever written — nothing from the raw request body is spread into the
 * document, so a client cannot set anything beyond those two fields.
 */
export async function register(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (existing) {
    throw new EmailAlreadyRegisteredError();
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({ email, passwordHash });

  const publicUser = toPublicUser(user);
  const accessToken = signAccessToken(publicUser);
  const refreshToken = await issueRefreshToken(user._id);

  return { user: publicUser, accessToken, refreshToken };
}

/**
 * Log in. `passwordHash` is excluded by the schema's `select: false` by
 * default — `.select('+passwordHash')` is the one deliberate opt-in,
 * scoped to exactly this lookup.
 */
export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new InvalidCredentialsError();
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError();
  }

  const publicUser = toPublicUser(user);
  const accessToken = signAccessToken(publicUser);
  const refreshToken = await issueRefreshToken(user._id);

  return { user: publicUser, accessToken, refreshToken };
}

/**
 * Rotate a refresh token. Reuse detection: presenting a token that has
 * already been revoked (i.e. it was already rotated once before) revokes
 * every refresh token belonging to that user — the standard response to a
 * refresh token turning up twice, which usually means it was stolen and
 * used by someone other than whoever rotated it first.
 */
export async function refresh(rawToken: string): Promise<AuthResult> {
  const tokenHash = hashOpaqueToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });

  if (!existing) {
    throw new InvalidRefreshTokenError();
  }

  if (existing.revokedAt) {
    // Reuse of an already-rotated token — treat as compromise.
    await RefreshToken.updateMany(
      { userId: existing.userId, revokedAt: null },
      { revokedAt: new Date() },
    );
    throw new InvalidRefreshTokenError();
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    throw new InvalidRefreshTokenError();
  }

  const user = await User.findById(existing.userId);
  if (!user) {
    throw new InvalidRefreshTokenError();
  }

  await RefreshToken.findByIdAndUpdate(existing._id, { revokedAt: new Date() });
  const newRefreshToken = await issueRefreshToken(user._id, existing._id);

  const publicUser = toPublicUser(user);
  const accessToken = signAccessToken(publicUser);

  return { user: publicUser, accessToken, refreshToken: newRefreshToken };
}

/** Revoke a single refresh token (logout on one device/session). */
export async function logout(rawToken: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);
  await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { revokedAt: new Date() });
}

/**
 * Always resolves the same way regardless of whether the email exists —
 * required per the blueprint (a differing response is a user-enumeration
 * oracle). The one exception, clearly scoped: outside production, the raw
 * token is returned so the flow is testable without a real email
 * provider, which is explicitly out of scope for this phase. This is a
 * known, documented limitation, not a production behavior.
 */
export async function forgotPassword(email: string): Promise<{ devToken?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return {};
  }

  const { raw, hash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await PasswordResetToken.create({ userId: user._id, tokenHash: hash, expiresAt });

  if (env.NODE_ENV !== 'production') {
    return { devToken: raw };
  }
  return {};
}

/**
 * Redeem a reset token. On success: hash the new password, mark the token
 * used (so it can't be replayed), and revoke every refresh token the user
 * has — per the blueprint's explicit rule that a password reset should
 * force re-authentication everywhere, not just leave existing sessions
 * alive with the old password's blast radius.
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashOpaqueToken(rawToken);
  const record = await PasswordResetToken.findOne({ tokenHash });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new InvalidResetTokenError();
  }

  const passwordHash = await hashPassword(newPassword);
  await User.findByIdAndUpdate(record.userId, { passwordHash });
  await PasswordResetToken.findByIdAndUpdate(record._id, { usedAt: new Date() });
  await RefreshToken.updateMany(
    { userId: record.userId, revokedAt: null },
    { revokedAt: new Date() },
  );
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const user = await User.findById(id);
  if (!user) return null;
  return toPublicUser(user);
}

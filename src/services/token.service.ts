import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env';
import type { AuthenticatedUser } from '../types/express';

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

/**
 * Sign a short-lived access token. HS256 is used explicitly (not left to
 * jsonwebtoken's default) so verification can pin the same algorithm —
 * the standard fix for "alg: none"/algorithm-confusion style JWT attacks.
 */
export function signAccessToken(user: AuthenticatedUser): string {
  const payload: AccessTokenPayload = { sub: user.id, email: user.email };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  });
}

/**
 * Verify an access token. Throws on anything wrong (expired, bad
 * signature, wrong algorithm, malformed) — callers (the auth middleware)
 * treat any throw as "not authenticated," not as a 500.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub || !decoded.email) {
    throw new Error('Malformed token payload');
  }
  return { sub: decoded.sub as string, email: decoded.email as string };
}

/**
 * Generate a high-entropy opaque token (used for both refresh tokens and
 * password-reset tokens) plus the SHA-256 hash that actually gets stored.
 * The raw value is returned to the caller exactly once — it is never
 * persisted anywhere, only its hash is.
 */
export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = hashOpaqueToken(raw);
  return { raw, hash };
}

export function hashOpaqueToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

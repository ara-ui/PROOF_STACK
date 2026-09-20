import type { Request, Response } from 'express';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';
import * as authService from '../services/auth.service';
import { getUserById } from '../services/auth.service';

function validationError(res: Response, error: unknown) {
  res.status(400).json({ error: 'ValidationError', details: (error as { flatten: () => unknown }).flatten() });
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof authService.EmailAlreadyRegisteredError) {
      res.status(409).json({ error: 'EmailAlreadyRegistered' });
      return;
    }
    throw err;
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const result = await authService.login(parsed.data);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof authService.InvalidCredentialsError) {
      res.status(401).json({ error: 'InvalidCredentials' });
      return;
    }
    throw err;
  }
}

export async function me(req: Request, res: Response) {
  // requireAuth has already run by the time this handler executes, so
  // req.user is guaranteed set — but the type is still optional, so this
  // check exists rather than a non-null assertion.
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const user = await getUserById(req.user.id);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.status(200).json({ user });
}

export async function refresh(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    const result = await authService.refresh(parsed.data.refreshToken);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof authService.InvalidRefreshTokenError) {
      res.status(401).json({ error: 'InvalidRefreshToken' });
      return;
    }
    throw err;
  }
}

export async function logout(req: Request, res: Response) {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  await authService.logout(parsed.data.refreshToken);
  res.status(200).json({ ok: true });
}

export async function forgotPassword(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const result = await authService.forgotPassword(parsed.data.email);
  // Same response shape regardless of whether the email existed — see
  // auth.service.ts's forgotPassword for the full reasoning. devToken is
  // only ever present outside production.
  res.status(200).json({ ok: true, ...result });
}

export async function resetPassword(req: Request, res: Response) {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  try {
    await authService.resetPassword(parsed.data.token, parsed.data.newPassword);
    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof authService.InvalidResetTokenError) {
      res.status(400).json({ error: 'InvalidResetToken' });
      return;
    }
    throw err;
  }
}

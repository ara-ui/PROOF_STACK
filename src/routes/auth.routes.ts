import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { rateLimit, ipKey } from '../middleware/rateLimit';
import * as authController from '../controllers/auth.controller';

export const authRouter = Router();

// 5 requests per 15 minutes per IP. These are exactly the endpoints where
// an unrestricted client can either brute-force credentials (login) or
// enumerate/spam accounts (register, forgot-password) — not a value
// chosen for any other endpoint, and not applied to /me or /logout.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyFn: ipKey,
  message: 'Too many attempts — try again later.',
});

authRouter.post('/auth/register', authRateLimit, asyncHandler(authController.register));
authRouter.post('/auth/login', authRateLimit, asyncHandler(authController.login));
authRouter.get('/auth/me', requireAuth, asyncHandler(authController.me));
authRouter.post('/auth/refresh', authRateLimit, asyncHandler(authController.refresh));
authRouter.post('/auth/logout', asyncHandler(authController.logout));
authRouter.post('/auth/forgot-password', authRateLimit, asyncHandler(authController.forgotPassword));
authRouter.post('/auth/reset-password', asyncHandler(authController.resetPassword));

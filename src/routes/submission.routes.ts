import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { rateLimit, userKey } from '../middleware/rateLimit';
import * as submissionController from '../controllers/submission.controller';

export const submissionRouter = Router();

// 10 submissions per minute per user — per the blueprint's explicit
// recommendation ("10/min is fine"). This is a MUST HAVE per the frozen
// roadmap's Phase 3 acceptance criteria, not deferred to later hardening:
// each submission costs real judge compute, so this endpoint specifically
// needed protection as soon as real (non-hardcoded) users existed.
const submissionRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyFn: userKey,
  message: 'Too many submissions — please slow down.',
});

submissionRouter.post(
  '/submissions',
  requireAuth,
  submissionRateLimit,
  asyncHandler(submissionController.create),
);
submissionRouter.get('/submissions/:id', requireAuth, asyncHandler(submissionController.getById));

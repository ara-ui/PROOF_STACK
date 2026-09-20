import type { Request, Response } from 'express';
import { createSubmissionSchema, submissionIdParamSchema } from '../validators/submission.validator';
import {
  createSubmission,
  getSubmissionById,
  ChallengeNotFoundError,
  SubmissionNotFoundError,
} from '../services/submission.service';

export async function create(req: Request, res: Response) {
  const parsed = createSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.flatten() });
    return;
  }

  // requireAuth has already run (see submission.routes.ts) — req.user is
  // guaranteed set on this path, but the type is still optional, so this
  // is a real check, not a non-null assertion.
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const result = await createSubmission(req.user.id, parsed.data);
    // 202: accepted, evaluation happens asynchronously. The API never
    // waits on the worker/judge here.
    res.status(202).json(result);
  } catch (err) {
    if (err instanceof ChallengeNotFoundError) {
      res.status(404).json({ error: 'ChallengeNotFound' });
      return;
    }
    throw err; // let the global error handler map anything else to a 500
  }
}

export async function getById(req: Request, res: Response) {
  const parsed = submissionIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.flatten() });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const submission = await getSubmissionById(parsed.data.id, req.user.id);
    res.status(200).json(submission);
  } catch (err) {
    if (err instanceof SubmissionNotFoundError) {
      res.status(404).json({ error: 'SubmissionNotFound' });
      return;
    }
    throw err;
  }
}

import type { Request, Response } from 'express';
import { challengeSlugParamSchema } from '../validators/challenge.validator';
import {
  listPublishedChallenges,
  getPublishedChallengeBySlug,
  ChallengeNotFoundError,
} from '../services/challenge.service';

export async function list(_req: Request, res: Response) {
  const challenges = await listPublishedChallenges();
  res.status(200).json({ challenges });
}

export async function getBySlug(req: Request, res: Response) {
  const parsed = challengeSlugParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: 'ValidationError', details: parsed.error.flatten() });
    return;
  }

  try {
    const challenge = await getPublishedChallengeBySlug(parsed.data.slug);
    res.status(200).json(challenge);
  } catch (err) {
    if (err instanceof ChallengeNotFoundError) {
      res.status(404).json({ error: 'ChallengeNotFound' });
      return;
    }
    throw err;
  }
}

import { Types } from 'mongoose';
import { Challenge, type ChallengeDoc } from '../models/Challenge';

export class ChallengeNotFoundError extends Error {
  constructor(slug: string) {
    super(`Challenge ${slug} not found`);
    this.name = 'ChallengeNotFoundError';
  }
}

// Shape returned to clients — never includes hidden test case input/output,
// and never includes isPublished (internal bookkeeping, not a client concern).
export interface PublicChallengeSummary {
  id: string;
  slug: string;
  title: string;
  difficulty: number;
  language: string;
  visibleTestCaseCount: number;
  hiddenTestCaseCount: number;
}

export interface PublicChallengeDetail extends PublicChallengeSummary {
  description: string;
  starterCode: string;
  timeLimitMs: number;
  visibleTestCases: { input: string; expectedOutput: string; category: string }[];
}

function toSummary(doc: ChallengeDoc & { _id: Types.ObjectId }): PublicChallengeSummary {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    title: doc.title,
    difficulty: doc.difficulty,
    language: doc.language,
    visibleTestCaseCount: doc.testCases.filter((t: { isHidden: boolean }) => !t.isHidden).length,
    hiddenTestCaseCount: doc.testCases.filter((t: { isHidden: boolean }) => t.isHidden).length,
  };
}

/**
 * List published challenges. Only known, server-controlled fields are ever
 * used to build the query (`isPublished: true`) — no client-supplied filter
 * object reaches Mongo here, consistent with the query constraint carried
 * forward from Phase 1.
 */
export async function listPublishedChallenges(): Promise<PublicChallengeSummary[]> {
  const challenges = await Challenge.find({ isPublished: true }).lean();
  return challenges.map((doc) => toSummary(doc as ChallengeDoc & { _id: Types.ObjectId }));
}

/**
 * Fetch one published challenge by slug, with hidden test cases stripped.
 * This is a lookup by a known identifier (slug), not a client-built filter.
 */
export async function getPublishedChallengeBySlug(slug: string): Promise<PublicChallengeDetail> {
  const doc = await Challenge.findOne({ slug, isPublished: true }).lean();
  if (!doc) {
    throw new ChallengeNotFoundError(slug);
  }
  const typed = doc as ChallengeDoc & { _id: Types.ObjectId };
  return {
    ...toSummary(typed),
    description: typed.description,
    starterCode: typed.starterCode,
    timeLimitMs: typed.timeLimitMs,
    visibleTestCases: typed.testCases
      .filter((t: { isHidden: boolean }) => !t.isHidden)
      .map((t: { input: string; expectedOutput: string; category: string }) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
        category: t.category,
      })),
  };
}

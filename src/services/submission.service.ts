import { Types } from 'mongoose';
import { Submission, type SubmissionDoc } from '../models/Submission';
import { Challenge } from '../models/Challenge';
import { enqueueEvaluationJob } from '../queues/evaluationQueue';

export class ChallengeNotFoundError extends Error {
  constructor(challengeId: string) {
    super(`Challenge ${challengeId} not found`);
    this.name = 'ChallengeNotFoundError';
  }
}

export class SubmissionNotFoundError extends Error {
  constructor(id: string) {
    super(`Submission ${id} not found`);
    this.name = 'SubmissionNotFoundError';
  }
}

/**
 * Create a submission and enqueue it for evaluation.
 *
 * Per the Phase 1 query constraint: the only Mongo lookup here is
 * `Challenge.findById(challengeId)` — a lookup by ID, not a client-supplied
 * filter. `userId` comes from the authenticated caller (req.user.id, set
 * by the auth middleware from a verified JWT) — never from the request
 * body. Phase 3 removes the Phase 1 hardcoded-user constant entirely.
 */
export async function createSubmission(
  userId: string,
  input: { challengeId: string; sourceCode: string },
): Promise<{ id: string; status: SubmissionDoc['status'] }> {
  const challenge = await Challenge.findById(input.challengeId);
  if (!challenge) {
    throw new ChallengeNotFoundError(input.challengeId);
  }

  const submission = await Submission.create({
    userId,
    challengeId: challenge._id,
    language: challenge.language,
    sourceCode: input.sourceCode,
    status: 'QUEUED',
  });

  // jobId = submission id, set inside enqueueEvaluationJob. If this throws
  // after the Mongo write above, the submission is left QUEUED with no job
  // — an intentional, minimal Phase 1 gap. Phase 9's stuck-submission
  // reconciliation is the real fix; not built here.
  await enqueueEvaluationJob(submission._id.toString());

  return { id: submission._id.toString(), status: submission.status };
}

/**
 * Read a submission by its own ID, scoped to the requesting user.
 *
 * Ownership check: a submission that exists but belongs to someone else
 * throws the same SubmissionNotFoundError as one that doesn't exist at
 * all — the caller (the controller) maps this to 404, never 403, so a
 * client can't distinguish "not yours" from "doesn't exist." This is the
 * blueprint's explicit rule, not an oversight.
 *
 * `userId` is a plain string comparison, not an ObjectId cast — the
 * Submission schema's `userId` field stayed a String (see Submission.ts)
 * specifically to avoid a schema migration; req.user.id is already a
 * string (the JWT's `sub` claim), so this is a direct comparison.
 */
export async function getSubmissionById(id: string, userId: string): Promise<SubmissionDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new SubmissionNotFoundError(id);
  }
  const submission = await Submission.findById(id).lean<SubmissionDoc>();
  if (!submission || submission.userId !== userId) {
    throw new SubmissionNotFoundError(id);
  }
  return submission;
}

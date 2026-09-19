import { Types } from 'mongoose';
import { Submission, type SubmissionDoc } from '../models/Submission';
import { Challenge } from '../models/Challenge';
import { HARDCODED_USER_ID } from '../config/constants';
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
 * filter. `userId` is never taken from the request; it's the module-level
 * hardcoded constant until Phase 3 introduces real auth.
 */
export async function createSubmission(input: {
  challengeId: string;
  sourceCode: string;
}): Promise<{ id: string; status: SubmissionDoc['status'] }> {
  const challenge = await Challenge.findById(input.challengeId);
  if (!challenge) {
    throw new ChallengeNotFoundError(input.challengeId);
  }

  const submission = await Submission.create({
    userId: HARDCODED_USER_ID,
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
 * Read a submission by its own ID. No ownership check — Phase 1 has no
 * authenticated users to check ownership against. That's Phase 3's job.
 */
export async function getSubmissionById(id: string): Promise<SubmissionDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new SubmissionNotFoundError(id);
  }
  const submission = await Submission.findById(id).lean<SubmissionDoc>();
  if (!submission) {
    throw new SubmissionNotFoundError(id);
  }
  return submission;
}

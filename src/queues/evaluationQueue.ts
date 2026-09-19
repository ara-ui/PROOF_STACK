import { Queue } from 'bullmq';
import { createRedisConnection } from '../config/redis';

export const EVALUATION_QUEUE_NAME = 'evaluation';

// One Queue instance per process. The API process uses this to enqueue;
// the worker process constructs its own BullMQ Worker (see
// src/workers/evaluation.worker.ts) pointed at the same queue name and
// Redis instance — they are not the same object, deliberately, since API
// and worker are two separate deployables.
export const evaluationQueue = new Queue(EVALUATION_QUEUE_NAME, {
  connection: createRedisConnection(),
});

export interface EvaluationJobData {
  submissionId: string;
}

/**
 * Enqueue an evaluation job for a submission.
 *
 * jobId = submissionId is the whole idempotency story at the enqueue layer:
 * BullMQ refuses to create a second job with a jobId that already exists
 * (active, waiting, or completed within the queue's retention window), so
 * calling this twice for the same submission does not create a duplicate
 * job. It returns the existing job rather than throwing.
 */
export async function enqueueEvaluationJob(submissionId: string) {
  return evaluationQueue.add(
    'evaluate',
    { submissionId } satisfies EvaluationJobData,
    {
      jobId: submissionId,
      // Deliberately no retries in Phase 1: a judge failure is written as
      // a terminal ERROR/JUDGE_UNAVAILABLE state (see the worker), not
      // retried automatically. Retry-with-backoff on transient judge
      // failures is real, but it's Phase 9 (Reliability) territory per the
      // frozen roadmap — adding it here would be scope creep for Phase 1.
      attempts: 1,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 3600 },
    },
  );
}

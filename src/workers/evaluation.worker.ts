import { Worker, type Job } from 'bullmq';
import { connectMongo } from '../config/db';
import { createRedisConnection } from '../config/redis';
import { EVALUATION_QUEUE_NAME, type EvaluationJobData } from '../queues/evaluationQueue';
import { Submission } from '../models/Submission';
import { Challenge } from '../models/Challenge';
import { executeOnPiston, JudgeUnavailableError } from '../services/piston.service';
import { TERMINAL_STATUSES, type FailureReason, type SubmissionStatus, type TestCaseResult } from '../types/submission';

/**
 * This file is a genuinely separate entrypoint from src/server.ts — it is
 * started as its own process (`npm run worker`), not imported by the API.
 * Per the blueprint, submitted code never runs inside the API or this
 * worker process; this file only ever makes an HTTP call to Piston
 * (see src/services/piston.service.ts).
 */

function normalize(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

/**
 * Runs every test case for a submission sequentially against Piston,
 * stopping early on the first infrastructure failure or timeout — running
 * further test cases after either of those tells us nothing useful.
 *
 * Returns a discriminated outcome the caller uses to decide the terminal
 * status: this function never touches the database.
 */
async function evaluateSubmission(
  sourceCode: string,
  challenge: { timeLimitMs: number; testCases: { input: string; expectedOutput: string; isHidden: boolean }[] },
): Promise<
  | { kind: 'JUDGE_FAILURE'; reason: FailureReason; message: string }
  | { kind: 'TIMEOUT' }
  | { kind: 'COMPLETED'; testResults: TestCaseResult[] }
> {
  const testResults: TestCaseResult[] = [];

  for (let index = 0; index < challenge.testCases.length; index += 1) {
    const testCase = challenge.testCases[index];

    let outcome;
    try {
      outcome = await executeOnPiston(sourceCode, testCase.input, challenge.timeLimitMs);
    } catch (err) {
      if (err instanceof JudgeUnavailableError) {
        return { kind: 'JUDGE_FAILURE', reason: 'JUDGE_UNAVAILABLE', message: err.message };
      }
      return { kind: 'JUDGE_FAILURE', reason: 'INTERNAL_ERROR', message: (err as Error).message };
    }

    if (outcome.timedOut) {
      return { kind: 'TIMEOUT' };
    }

    // Heuristic for JS on Piston: there's no separate compile step, so a
    // non-zero exit with "SyntaxError" in stderr on the FIRST test case is
    // treated as a compile-time problem; any other non-zero exit is a
    // runtime error. This is a simplification worth revisiting once real
    // submissions show what Piston actually returns for JS — noted here
    // rather than treated as settled.
    if (outcome.exitCode !== 0 && outcome.exitCode !== null) {
      const looksLikeSyntaxError = /SyntaxError/.test(outcome.stderr);
      return {
        kind: 'JUDGE_FAILURE',
        reason: looksLikeSyntaxError && index === 0 ? 'COMPILE_ERROR' : 'RUNTIME_ERROR',
        message: outcome.stderr || `Process exited with code ${outcome.exitCode}`,
      };
    }

    const passed = normalize(outcome.stdout) === normalize(testCase.expectedOutput);

    testResults.push({
      index,
      passed,
      isHidden: testCase.isHidden,
      // Hidden test case actual/expected output is not stored on the
      // result we'll eventually return via the API — minimal safeguard
      // against leaking answers, see src/types/submission.ts.
      actualOutput: testCase.isHidden ? undefined : outcome.stdout,
      expectedOutput: testCase.isHidden ? undefined : testCase.expectedOutput,
      truncated: outcome.stdoutTruncated,
    });
  }

  return { kind: 'COMPLETED', testResults };
}

async function processJob(job: Job<EvaluationJobData>): Promise<void> {
  const { submissionId } = job.data;

  // --- Atomic claim -------------------------------------------------
  // Only a submission currently QUEUED can be claimed. If this matches
  // nothing, the job has already been processed (e.g. a redelivered job
  // after this same worker's claim succeeded but it crashed before
  // acking) or the submission doesn't exist — either way, do not proceed,
  // and do not treat it as an error.
  const claimed = await Submission.findOneAndUpdate(
    { _id: submissionId, status: 'QUEUED' },
    { status: 'RUNNING', startedAt: new Date() },
    { new: true },
  );

  if (!claimed) {
    // eslint-disable-next-line no-console
    console.warn(`[worker] submission ${submissionId} was not in QUEUED state — skipping (idempotency guard)`);
    return;
  }

  const challenge = await Challenge.findById(claimed.challengeId);
  if (!challenge) {
    await writeTerminalState(submissionId, 'ERROR', 'INTERNAL_ERROR', null);
    return;
  }

  const outcome = await evaluateSubmission(claimed.sourceCode, {
    timeLimitMs: challenge.timeLimitMs,
    testCases: challenge.testCases,
  });

  if (outcome.kind === 'JUDGE_FAILURE') {
    // eslint-disable-next-line no-console
    console.error(`[worker] submission ${submissionId} judge failure: ${outcome.message}`);
    await writeTerminalState(submissionId, 'ERROR', outcome.reason, null);
    return;
  }

  if (outcome.kind === 'TIMEOUT') {
    await writeTerminalState(submissionId, 'TIMEOUT', 'TIMEOUT', null);
    return;
  }

  const passedCount = outcome.testResults.filter((t) => t.passed).length;
  const totalCount = outcome.testResults.length;
  const result = { passedCount, totalCount, testResults: outcome.testResults };

  if (passedCount === totalCount) {
    await writeTerminalState(submissionId, 'PASSED', null, result);
  } else {
    await writeTerminalState(submissionId, 'FAILED', 'WRONG_ANSWER', result);
  }
}

/**
 * Terminal-state guard: only writes if the submission is still RUNNING.
 * A submission that has already reached a terminal state (from an earlier,
 * successful processing of a duplicate/redelivered job) is never
 * overwritten — this is what makes "a late worker attempt cannot corrupt
 * an already-completed submission" true rather than assumed.
 */
async function writeTerminalState(
  submissionId: string,
  status: SubmissionStatus,
  failureReason: FailureReason | null,
  result: { passedCount: number; totalCount: number; testResults: TestCaseResult[] } | null,
): Promise<void> {
  if (!TERMINAL_STATUSES.includes(status)) {
    throw new Error(`writeTerminalState called with non-terminal status ${status}`);
  }

  const updated = await Submission.findOneAndUpdate(
    { _id: submissionId, status: 'RUNNING' },
    { status, failureReason, result, completedAt: new Date() },
    { new: true },
  );

  if (!updated) {
    // eslint-disable-next-line no-console
    console.warn(
      `[worker] submission ${submissionId} was not RUNNING at completion time — ` +
        `refusing to overwrite (terminal-state guard)`,
    );
  }
}

async function main() {
  await connectMongo();

  const worker = new Worker<EvaluationJobData>(EVALUATION_QUEUE_NAME, processJob, {
    connection: createRedisConnection(),
    concurrency: 1, // Phase 1: one submission at a time, deliberately simple
  });

  worker.on('failed', (job, err) => {
    // A thrown error from processJob lands here. Per the Phase 1 scope
    // decision (attempts: 1, see evaluationQueue.ts), there is no retry —
    // the submission is left in whatever state processJob left it in
    // (likely RUNNING, uncompleted). Reconciling stuck submissions like
    // this is explicitly Phase 9 territory, not handled here.
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} failed`, err);
  });

  worker.on('ready', () => {
    // eslint-disable-next-line no-console
    console.log('[worker] ready, waiting for evaluation jobs');
  });

  const shutdown = async () => {
    // eslint-disable-next-line no-console
    console.log('[worker] shutting down...');
    await worker.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[worker] fatal startup error', err);
  process.exit(1);
});

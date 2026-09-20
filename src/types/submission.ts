// Shared types for the submission pipeline. Kept here rather than inline in
// the model so the worker, service, and controller all reference the same
// literal unions instead of re-typing strings that could drift apart.

export const SUBMISSION_STATUSES = [
  'QUEUED',
  'RUNNING',
  'PASSED',
  'FAILED',
  'TIMEOUT',
  'ERROR',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const TERMINAL_STATUSES: readonly SubmissionStatus[] = [
  'PASSED',
  'FAILED',
  'TIMEOUT',
  'ERROR',
];

// Distinguishes *why* a non-PASSED terminal state happened. Per the frozen
// roadmap: candidate-caused failures must be distinguishable from
// infrastructure/judge failures — never collapse everything into FAILED.
export const FAILURE_REASONS = [
  'WRONG_ANSWER', // FAILED: ran fine, output didn't match
  'COMPILE_ERROR', // ERROR: candidate's code didn't parse/compile
  'RUNTIME_ERROR', // ERROR: candidate's code threw during execution
  'TIMEOUT', // TIMEOUT: candidate's code exceeded the time limit
  'JUDGE_UNAVAILABLE', // ERROR: our infrastructure — Piston unreachable/errored
  'INTERNAL_ERROR', // ERROR: our infrastructure — anything else unexpected
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export interface TestCaseResult {
  index: number;
  passed: boolean;
  isHidden: boolean;
  // Category is always shown, even for hidden test cases — it's structural
  // information ("Edge Cases: 4/5"), not an answer, so it doesn't need the
  // same masking as actualOutput/expectedOutput.
  category: string;
  // Actual stdout is included only for visible test cases. Hidden test
  // case answers are not echoed back — a minimal safeguard, not the full
  // Phase 2+ challenge-authoring system.
  actualOutput?: string;
  expectedOutput?: string;
  timeMs?: number;
  truncated?: boolean;
}

export interface CategoryBreakdown {
  category: string;
  passed: number;
  total: number;
}

export interface SubmissionResult {
  passedCount: number;
  totalCount: number;
  testResults: TestCaseResult[];
  // Phase 2: lets the API report "Basic: 8/8, Edge Cases: 4/5" instead of
  // one flat passedCount/totalCount pair.
  categoryBreakdown: CategoryBreakdown[];
}

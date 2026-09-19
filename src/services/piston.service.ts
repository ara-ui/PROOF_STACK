import { env } from '../config/env';
import { PISTON_HTTP_BUFFER_MS, MAX_OUTPUT_BYTES } from '../config/constants';

/**
 * Client for the self-hosted Piston judge (see docker-compose.yml — Piston
 * runs on its own `judge` network with no route to Mongo/Redis).
 *
 * This is the ONLY place in the codebase that sends code for execution.
 * Nothing here ever calls `child_process` or executes source locally —
 * that boundary is the entire point of delegating to Piston rather than
 * building a sandbox, per the blueprint.
 */

export class JudgeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JudgeUnavailableError';
  }
}

export interface PistonRunOutcome {
  timedOut: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
}

interface PistonExecuteResponse {
  run?: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
    output: string;
  };
  compile?: {
    stdout: string;
    stderr: string;
    code: number | null;
    signal: string | null;
  };
  message?: string; // present on Piston-side errors (e.g. unknown runtime)
}

function capOutput(s: string): { text: string; truncated: boolean } {
  if (s.length <= MAX_OUTPUT_BYTES) return { text: s, truncated: false };
  return { text: s.slice(0, MAX_OUTPUT_BYTES), truncated: true };
}

/**
 * Execute `sourceCode` against `stdin` with a wall-clock budget of
 * `timeLimitMs`, via the self-hosted Piston instance at PISTON_URL.
 *
 * Two layers of timeout, per the blueprint's "external timeout as
 * backstop" guidance:
 *  1. Piston's own `run_timeout` kills the candidate's process.
 *  2. An AbortController on the HTTP call itself, with extra buffer, in
 *     case Piston's own timeout mechanism doesn't return promptly (e.g.
 *     Piston itself is degraded rather than the candidate's code).
 *
 * Throws JudgeUnavailableError for anything that indicates OUR
 * infrastructure failed to get a real answer (network error, non-2xx,
 * malformed response) — the caller (the worker) is responsible for
 * mapping that to status ERROR / failureReason JUDGE_UNAVAILABLE.
 * A timed-out candidate process is NOT an error — it's reported back as
 * `timedOut: true` for the caller to map to status TIMEOUT.
 */
export async function executeOnPiston(
  sourceCode: string,
  stdin: string,
  timeLimitMs: number,
): Promise<PistonRunOutcome> {
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeLimitMs + PISTON_HTTP_BUFFER_MS);

  let response: Response;
  try {
    response = await fetch(`${env.PISTON_URL}/api/v2/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        language: env.PISTON_LANGUAGE,
        version: env.PISTON_VERSION,
        files: [{ name: 'main.js', content: sourceCode }],
        stdin,
        run_timeout: timeLimitMs,
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // The HTTP call itself was aborted by our outer backstop timer —
      // Piston never returned in time. Treat as an infrastructure failure,
      // not a candidate timeout: we don't actually know whether the
      // candidate's process finished or not.
      throw new JudgeUnavailableError(
        `Piston did not respond within ${timeLimitMs + PISTON_HTTP_BUFFER_MS}ms`,
      );
    }
    throw new JudgeUnavailableError(
      `Failed to reach Piston at ${env.PISTON_URL}: ${(err as Error).message}`,
    );
  } finally {
    clearTimeout(abortTimer);
  }

  if (!response.ok) {
    throw new JudgeUnavailableError(`Piston responded with HTTP ${response.status}`);
  }

  let data: PistonExecuteResponse;
  try {
    data = (await response.json()) as PistonExecuteResponse;
  } catch (err) {
    throw new JudgeUnavailableError('Piston returned a non-JSON response');
  }

  if (!data.run) {
    // Piston-side error before it even ran the code (e.g. unknown
    // language/version) — this is an infrastructure/config problem, not
    // the candidate's fault.
    throw new JudgeUnavailableError(data.message ?? 'Piston returned no run result');
  }

  // Piston reports a killed-by-timeout process via a SIGKILL signal on the
  // run result. This is the candidate's code exceeding the time limit —
  // NOT a JudgeUnavailableError.
  const timedOut = data.run.signal === 'SIGKILL' || data.run.signal === 'SIGTERM';

  const stdoutCap = capOutput(data.run.stdout ?? '');
  const stderrCap = capOutput(data.run.stderr ?? '');

  return {
    timedOut,
    exitCode: data.run.code,
    stdout: stdoutCap.text,
    stderr: stderrCap.text,
    stdoutTruncated: stdoutCap.truncated || stderrCap.truncated,
  };
}

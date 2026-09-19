import type { Request, Response, NextFunction } from 'express';

// Intentionally minimal for Phase 1: log and return a generic 500. Request
// correlation IDs (X-Request-Id) and structured Pino logging are called
// out in the blueprint but scoped to a later phase — not added here to
// avoid pulling in infrastructure Phase 1 doesn't need.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'InternalServerError' });
}

import type { Request, Response, NextFunction } from 'express';
import { createRedisConnection } from '../config/redis';

// One connection for all rate limiters in this process — this is a small,
// frequent INCR/PEXPIRE workload, not worth a connection per limiter.
// Separate from the BullMQ connections in queues/workers (those have their
// own, per createRedisConnection's existing per-process convention).
const redis = createRedisConnection();

interface RateLimitOptions {
  windowMs: number;
  max: number;
  // What identifies the caller for this limiter — IP for unauthenticated
  // endpoints (register/login/forgot-password have no req.user yet), user
  // id for authenticated ones (submissions).
  keyFn: (req: Request) => string;
  message?: string;
}

/**
 * Fixed-window counter via Redis INCR + PEXPIRE-on-first-hit. Simpler than
 * a sliding window and sufficient here — the goal is "stop a script from
 * draining the judge or brute-forcing login," not precise traffic shaping.
 */
export function rateLimit(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `ratelimit:${options.keyFn(req)}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, options.windowMs);
      }

      if (count > options.max) {
        res.status(429).json({ error: 'TooManyRequests', message: options.message ?? 'Rate limit exceeded' });
        return;
      }

      next();
    } catch (err) {
      // Redis being unavailable should not take down auth/submissions
      // entirely — fail open rather than closed. Logged so a real outage
      // is still visible, just not user-facing as a hard failure.
      // eslint-disable-next-line no-console
      console.error('[rateLimit] Redis error, failing open:', err);
      next();
    }
  };
}

/** IP-based — for endpoints with no authenticated user yet. */
export function ipKey(req: Request): string {
  return req.ip ?? 'unknown';
}

/** User-based — for endpoints behind requireAuth, where req.user exists. */
export function userKey(req: Request): string {
  return req.user?.id ?? ipKey(req);
}

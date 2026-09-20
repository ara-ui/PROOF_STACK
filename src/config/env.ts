import 'dotenv/config';
import { z } from 'zod';

// Phase 1/2 vars, plus Phase 3 auth config below.
const envSchema = z.object({
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PISTON_URL: z.string().url(),
  PISTON_LANGUAGE: z.string().default('javascript'),
  PISTON_VERSION: z.string().default('18.15.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Phase 3: no default on purpose — a missing or short secret should fail
  // startup loudly, not silently run with a weak/undefined key. Generate
  // one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // Passed straight to jsonwebtoken's `expiresIn` — string format like '24h'.
  JWT_ACCESS_TOKEN_TTL: z.string().default('24h'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loudly rather than starting with an undefined config value.
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

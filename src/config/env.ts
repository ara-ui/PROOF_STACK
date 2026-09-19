import 'dotenv/config';
import { z } from 'zod';

// Phase 1 scope only. JWT_SECRET and other auth vars intentionally absent
// until Phase 3 — do not add them here.
const envSchema = z.object({
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PISTON_URL: z.string().url(),
  PISTON_LANGUAGE: z.string().default('javascript'),
  PISTON_VERSION: z.string().default('18.15.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast and loudly rather than starting with an undefined config value.
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

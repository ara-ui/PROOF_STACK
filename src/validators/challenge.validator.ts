import { z } from 'zod';

// Same reasoning as submission.validator.ts: this is what stands between
// a route param and a Mongo query value. Express param parsing should
// always give us a string, but validating it explicitly (rather than
// trusting that) is the cheap, correct habit — especially since
// `sanitizeFilter` protects filter *structure*, not a value that's
// already a string but not shaped like a real slug.
export const challengeSlugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens only'),
});

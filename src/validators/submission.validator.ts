import { z } from 'zod';
import { MAX_SOURCE_CODE_BYTES } from '../config/constants';

// Every field a client can supply, and nothing else. In particular:
// no `userId`, no `status`, no `failureReason` — those are server-assigned.
// This is what stands between a request body and a Mongo query/write; per
// the Phase 1 rule, nothing from this validated shape is used to build a
// filter object, only to construct a new document with named fields.
export const createSubmissionSchema = z.object({
  challengeId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i, 'challengeId must be a valid Mongo ObjectId'),
  sourceCode: z
    .string()
    .min(1, 'sourceCode must not be empty')
    .max(MAX_SOURCE_CODE_BYTES, `sourceCode must not exceed ${MAX_SOURCE_CODE_BYTES} bytes`),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

// Route param validator for GET /submissions/:id — same reasoning: this is
// what stops an arbitrary string from ever reaching `findById`.
export const submissionIdParamSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'id must be a valid Mongo ObjectId'),
});

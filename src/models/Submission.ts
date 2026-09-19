import { Schema, model, Types, type InferSchemaType } from 'mongoose';
import { SUBMISSION_STATUSES, FAILURE_REASONS } from '../types/submission';

const testCaseResultSchema = new Schema(
  {
    index: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    isHidden: { type: Boolean, required: true },
    actualOutput: { type: String },
    expectedOutput: { type: String },
    timeMs: { type: Number },
    truncated: { type: Boolean },
  },
  { _id: false },
);

const resultSchema = new Schema(
  {
    passedCount: { type: Number, required: true },
    totalCount: { type: Number, required: true },
    testResults: { type: [testCaseResultSchema], required: true },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    // Phase 1 has no auth — this is the constant hardcoded user id from
    // src/config/constants.ts, stored as a plain string rather than an
    // ObjectId ref to a User collection that doesn't exist until Phase 3.
    userId: { type: String, required: true },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true },
    language: { type: String, required: true, enum: ['javascript'] },
    // 64KB cap is enforced in the Zod validator before this is ever
    // constructed, not here — this is a second, cheap backstop.
    sourceCode: { type: String, required: true, maxlength: 65_536 },
    status: {
      type: String,
      required: true,
      enum: SUBMISSION_STATUSES,
      default: 'QUEUED',
    },
    failureReason: {
      type: String,
      enum: FAILURE_REASONS,
      default: null,
    },
    result: { type: resultSchema, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { strict: 'throw', timestamps: true }, // timestamps gives createdAt/updatedAt
);

// Supports the Phase-9-deferred stuck-submission reconciliation job and any
// "my submissions" style listing later — not exercised by Phase 1 itself,
// but cheap to declare now and it only ever filters on known fields.
submissionSchema.index({ status: 1, createdAt: 1 });
submissionSchema.index({ userId: 1, createdAt: -1 });

export type SubmissionDoc = InferSchemaType<typeof submissionSchema> & { _id: Types.ObjectId };
export const Submission = model('Submission', submissionSchema);

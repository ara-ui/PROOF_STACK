import { Schema, model, type InferSchemaType } from 'mongoose';

// Minimal Phase 1 challenge shape. `skills` is present but unused until
// Phase 4 (Evidence Engine) — kept as an empty array for now rather than
// omitted, so the seed data doesn't need reshaping later.
const testCaseSchema = new Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, required: true, default: false },
    // Phase 2: lets results report "Basic: 8/8, Edge Cases: 4/5" instead
    // of one flat pass count. Free-form string rather than an enum —
    // challenge authors coin categories as needed; nothing downstream
    // depends on a fixed set of names.
    category: { type: String, required: true, default: 'general' },
  },
  { _id: false },
);

const challengeSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: Number, required: true, min: 1, max: 3 },
    language: { type: String, required: true, enum: ['javascript'] },
    starterCode: { type: String, default: '' },
    timeLimitMs: { type: Number, required: true, min: 100, max: 30_000 },
    skills: { type: [Schema.Types.Mixed], default: [] }, // Phase 4 territory
    isPublished: { type: Boolean, default: false },
    testCases: {
      type: [testCaseSchema],
      required: true,
      validate: {
        validator: (v: unknown[]) => Array.isArray(v) && v.length >= 2,
        message: 'A challenge needs at least two test cases.',
      },
    },
  },
  { strict: 'throw', timestamps: true },
);

export type ChallengeDoc = InferSchemaType<typeof challengeSchema>;
export const Challenge = model('Challenge', challengeSchema);

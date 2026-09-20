import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    // Stored lowercased so lookups are case-insensitive without needing a
    // case-insensitive index/collation — the normalization happens once,
    // at write time, in auth.service.ts, not scattered across every query.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false — this is what keeps the hash out of every response
    // by default. Any code that genuinely needs it must opt in with
    // `.select('+passwordHash')` explicitly (see auth.service.ts login).
    passwordHash: { type: String, required: true, select: false },
  },
  { strict: 'throw', timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);

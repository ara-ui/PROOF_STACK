import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // SHA-256 hash of the raw token — the raw value is only ever seen by
    // the client, never persisted. High-entropy random tokens don't need
    // bcrypt; a fast hash is fine and correct here (per the blueprint).
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Links a rotated-out token to the token that replaced it — mostly
    // useful for incident review (tracing a reuse-detected chain), not
    // read by any Phase 3 code path itself.
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken', default: null },
  },
  { strict: 'throw', timestamps: true },
);

// TTL index: MongoDB deletes the document once expiresAt has passed,
// entirely server-side — no cleanup job needed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ userId: 1 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema> & { _id: Types.ObjectId };
export const RefreshToken = model('RefreshToken', refreshTokenSchema);

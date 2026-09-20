import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    // Single-use: set once the token is successfully redeemed. Checked
    // explicitly (not just relied on via TTL) before honoring a reset, so
    // a token can't be replayed within its own expiry window.
    usedAt: { type: Date, default: null },
  },
  { strict: 'throw', timestamps: true },
);

// TTL index: MongoDB deletes the document once expiresAt has passed.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ userId: 1 });

export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema> & {
  _id: Types.ObjectId;
};
export const PasswordResetToken = model('PasswordResetToken', passwordResetTokenSchema);

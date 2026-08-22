import mongoose, { type Model, type Types } from 'mongoose';

export interface PasswordResetToken {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetTokenSchema = new mongoose.Schema<PasswordResetToken>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  {
    collection: 'password_reset_tokens',
    strict: 'throw',
    timestamps: true,
  },
);

passwordResetTokenSchema.index(
  { tokenHash: 1 },
  { unique: true, name: 'unique_password_reset_token_hash' },
);
passwordResetTokenSchema.index(
  { userId: 1 },
  { name: 'password_reset_token_user' },
);
passwordResetTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'password_reset_token_ttl' },
);

export const PasswordResetTokenModel =
  (mongoose.models.PasswordResetToken as
    Model<PasswordResetToken> | undefined) ??
  mongoose.model<PasswordResetToken>(
    'PasswordResetToken',
    passwordResetTokenSchema,
  );

import mongoose, { type Model, type Types } from 'mongoose';

export interface RefreshSession {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedBySessionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSessionSchema = new mongoose.Schema<RefreshSession>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBySessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RefreshSession',
    },
  },
  {
    collection: 'refresh_sessions',
    strict: 'throw',
    timestamps: true,
  },
);

refreshSessionSchema.index(
  { tokenHash: 1 },
  { unique: true, name: 'unique_refresh_session_token_hash' },
);
refreshSessionSchema.index({ userId: 1 }, { name: 'refresh_session_user' });
refreshSessionSchema.index(
  { expiresAt: 1 },
  { name: 'refresh_session_expiry' },
);
refreshSessionSchema.index(
  { userId: 1, revokedAt: 1 },
  { name: 'refresh_session_user_revocation' },
);

export const RefreshSessionModel =
  (mongoose.models.RefreshSession as Model<RefreshSession> | undefined) ??
  mongoose.model<RefreshSession>('RefreshSession', refreshSessionSchema);

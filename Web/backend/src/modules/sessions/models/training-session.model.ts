import mongoose, { type Model, type Types } from 'mongoose';

import { SESSION_STATUSES, type SessionStatus } from '../domain/session.js';

export interface TrainingSession {
  trainingId: Types.ObjectId;
  title: string;
  identifier?: string;
  capacity: number;
  enrolledCount: number;
  assignedTrainerIds: Types.ObjectId[];
  location: string;
  address: string;
  room?: string;
  additionalInformation: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
}

const trainingSessionSchema = new mongoose.Schema<TrainingSession>(
  {
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    identifier: { type: String, trim: true, minlength: 1, maxlength: 100 },
    capacity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    enrolledCount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
      default: 0,
    },
    assignedTrainerIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    room: { type: String, trim: true, minlength: 1, maxlength: 100 },
    additionalInformation: {
      type: String,
      trim: true,
      maxlength: 2_000,
      default: '',
    },
    status: {
      type: String,
      required: true,
      enum: SESSION_STATUSES,
      default: 'PLANNED',
    },
  },
  {
    collection: 'training_sessions',
    strict: 'throw',
    timestamps: true,
  },
);

trainingSessionSchema.index(
  { trainingId: 1, status: 1, createdAt: -1 },
  { name: 'training_session_listing' },
);
trainingSessionSchema.index(
  { assignedTrainerIds: 1, status: 1 },
  { name: 'assigned_trainer_sessions' },
);
trainingSessionSchema.index(
  { trainingId: 1, identifier: 1 },
  {
    unique: true,
    partialFilterExpression: { identifier: { $type: 'string' } },
    name: 'unique_session_identifier_per_training',
  },
);

export const TrainingSessionModel =
  (mongoose.models.TrainingSession as Model<TrainingSession> | undefined) ??
  mongoose.model<TrainingSession>('TrainingSession', trainingSessionSchema);

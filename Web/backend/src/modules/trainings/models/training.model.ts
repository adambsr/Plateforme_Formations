import mongoose, { type Model, type Types } from 'mongoose';

import {
  TND_CURRENCY,
  TRAINING_STATUSES,
  TRAINING_TYPES,
  type TrainingStatus,
  type TrainingType,
} from '../domain/training.js';

export interface Training {
  title: string;
  description: string;
  categoryId: Types.ObjectId;
  level: string;
  durationMinutes: number;
  objectives: string[];
  prerequisites: string[];
  type: TrainingType;
  priceMinor: number;
  currency: typeof TND_CURRENCY;
  ownerTrainerId: Types.ObjectId;
  status: TrainingStatus;
  minimumAttendancePercent?: number;
  certifyingEvaluationId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const trainingSchema = new mongoose.Schema<Training>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5_000,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'TrainingCategory',
    },
    level: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    durationMinutes: { type: Number, required: true, min: 1, max: 52_560_000 },
    objectives: {
      type: [{ type: String, trim: true, minlength: 1, maxlength: 500 }],
      required: true,
      default: [],
    },
    prerequisites: {
      type: [{ type: String, trim: true, minlength: 1, maxlength: 500 }],
      required: true,
      default: [],
    },
    type: {
      type: String,
      required: true,
      enum: TRAINING_TYPES,
      immutable: true,
    },
    priceMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: {
      type: String,
      required: true,
      enum: [TND_CURRENCY],
      immutable: true,
    },
    ownerTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    status: {
      type: String,
      required: true,
      enum: TRAINING_STATUSES,
      default: 'DRAFT',
    },
    minimumAttendancePercent: { type: Number, min: 1, max: 100 },
    certifyingEvaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evaluation',
    },
  },
  {
    collection: 'trainings',
    strict: 'throw',
    timestamps: true,
  },
);

trainingSchema.index(
  { status: 1, categoryId: 1, type: 1, createdAt: -1 },
  { name: 'training_public_catalogue' },
);
trainingSchema.index(
  { ownerTrainerId: 1, status: 1, createdAt: -1 },
  { name: 'training_owner_dashboard' },
);

export const TrainingModel =
  (mongoose.models.Training as Model<Training> | undefined) ??
  mongoose.model<Training>('Training', trainingSchema);

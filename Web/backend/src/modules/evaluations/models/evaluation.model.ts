import mongoose, { type Model, type Types } from 'mongoose';
import {
  EVALUATION_STATUSES,
  type EvaluationStatus,
} from '../domain/evaluation.js';
export interface Evaluation {
  trainingId: Types.ObjectId;
  ownerTrainerId: Types.ObjectId;
  title: string;
  instructions: string;
  status: EvaluationStatus;
  passPercentage: number;
  maxAttempts: number;
  durationMinutes?: number;
  publishedAt?: Date;
  archivedAt?: Date;
  aiGeneration?: {
    provider: string;
    model: string;
    generatedAt: Date;
    contextChars: number;
    resourceCount: number;
    skippedResourceCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
const aiSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    model: { type: String, required: true },
    generatedAt: { type: Date, required: true },
    contextChars: { type: Number, required: true, min: 1 },
    resourceCount: { type: Number, required: true, min: 0 },
    skippedResourceCount: { type: Number, required: true, min: 0 },
  },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema<Evaluation>(
  {
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    ownerTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    instructions: { type: String, trim: true, maxlength: 5_000, default: '' },
    status: {
      type: String,
      required: true,
      enum: EVALUATION_STATUSES,
      default: 'DRAFT',
    },
    passPercentage: { type: Number, required: true, min: 1, max: 100 },
    maxAttempts: { type: Number, required: true, min: 1, max: 100, default: 3 },
    durationMinutes: { type: Number, min: 1, max: 10_080 },
    publishedAt: Date,
    archivedAt: Date,
    aiGeneration: { type: aiSchema },
  },
  { collection: 'evaluations', strict: 'throw', timestamps: true },
);
schema.index(
  { trainingId: 1, status: 1, createdAt: -1 },
  { name: 'evaluation_training_status' },
);
schema.index(
  { ownerTrainerId: 1, status: 1, createdAt: -1 },
  { name: 'evaluation_owner_status' },
);
export const EvaluationModel =
  (mongoose.models.Evaluation as Model<Evaluation> | undefined) ??
  mongoose.model<Evaluation>('Evaluation', schema);

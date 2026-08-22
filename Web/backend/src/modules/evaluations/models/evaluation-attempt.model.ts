import mongoose, { type Model, type Types } from 'mongoose';
import { ATTEMPT_STATUSES, type AttemptStatus } from '../domain/evaluation.js';
export interface EvaluationSettingsSnapshot {
  passPercentage: number;
  maxAttempts: number;
  durationMinutes?: number;
}
export interface EvaluationAttempt {
  evaluationId: Types.ObjectId;
  trainingId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  attemptNumber: number;
  status: AttemptStatus;
  startedAt: Date;
  expiresAt?: Date;
  submittedAt?: Date;
  scorePoints?: number;
  totalPoints?: number;
  scorePercentage?: number;
  settings: EvaluationSettingsSnapshot;
  createdAt: Date;
  updatedAt: Date;
}
const settingsSchema = new mongoose.Schema<EvaluationSettingsSnapshot>(
  {
    passPercentage: { type: Number, required: true },
    maxAttempts: { type: Number, required: true },
    durationMinutes: Number,
  },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema<EvaluationAttempt>(
  {
    evaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Evaluation',
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Enrollment',
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    attemptNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ATTEMPT_STATUSES,
      default: 'IN_PROGRESS',
    },
    startedAt: { type: Date, required: true },
    expiresAt: Date,
    submittedAt: Date,
    scorePoints: Number,
    totalPoints: Number,
    scorePercentage: Number,
    settings: { type: settingsSchema, required: true },
  },
  { collection: 'evaluation_attempts', strict: 'throw', timestamps: true },
);
schema.index(
  { enrollmentId: 1, evaluationId: 1, attemptNumber: 1 },
  { unique: true, name: 'unique_evaluation_attempt_number' },
);
schema.index(
  { learnerId: 1, evaluationId: 1, createdAt: -1 },
  { name: 'learner_evaluation_attempts' },
);
schema.index(
  { evaluationId: 1, status: 1, submittedAt: -1 },
  { name: 'evaluation_results' },
);
schema.index(
  { enrollmentId: 1, evaluationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'IN_PROGRESS' },
    name: 'one_active_evaluation_attempt',
  },
);
export const EvaluationAttemptModel =
  (mongoose.models.EvaluationAttempt as Model<EvaluationAttempt> | undefined) ??
  mongoose.model<EvaluationAttempt>('EvaluationAttempt', schema);

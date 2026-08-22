import mongoose, { type Model, type Types } from 'mongoose';
import { QUESTION_TYPES, type QuestionType } from '../domain/evaluation.js';
export interface EvaluationOption {
  id: string;
  text: string;
}
export interface EvaluationQuestion {
  evaluationId: Types.ObjectId;
  trainingId: Types.ObjectId;
  order: number;
  points: number;
  prompt: string;
  explanation?: string;
  type: QuestionType;
  options: EvaluationOption[];
  correctOptionIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
export const optionSchema = new mongoose.Schema<EvaluationOption>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema<EvaluationQuestion>(
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
    order: { type: Number, required: true, min: 1 },
    points: { type: Number, required: true, min: 1 },
    prompt: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5_000,
    },
    explanation: { type: String, trim: true, maxlength: 5_000 },
    type: { type: String, required: true, enum: QUESTION_TYPES },
    options: { type: [optionSchema], required: true },
    correctOptionIds: { type: [String], required: true },
  },
  { collection: 'evaluation_questions', strict: 'throw', timestamps: true },
);
schema.index(
  { evaluationId: 1, order: 1 },
  { unique: true, name: 'unique_question_order_per_evaluation' },
);
schema.index(
  { trainingId: 1, evaluationId: 1 },
  { name: 'question_training_evaluation' },
);
export const EvaluationQuestionModel =
  (mongoose.models.EvaluationQuestion as
    Model<EvaluationQuestion> | undefined) ??
  mongoose.model<EvaluationQuestion>('EvaluationQuestion', schema);

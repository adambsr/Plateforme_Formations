import mongoose, { type Model, type Types } from 'mongoose';
import { QUESTION_TYPES, type QuestionType } from '../domain/evaluation.js';
import {
  optionSchema,
  type EvaluationOption,
} from './evaluation-question.model.js';
export interface EvaluationAnswer {
  attemptId: Types.ObjectId;
  questionId: Types.ObjectId;
  selectedOptionIds: string[];
  awardedPoints?: number;
  snapshot: {
    order: number;
    points: number;
    prompt: string;
    explanation?: string;
    type: QuestionType;
    options: EvaluationOption[];
    correctOptionIds: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
const snapshotSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    points: { type: Number, required: true },
    prompt: { type: String, required: true },
    explanation: String,
    type: { type: String, required: true, enum: QUESTION_TYPES },
    options: { type: [optionSchema], required: true },
    correctOptionIds: { type: [String], required: true },
  },
  { _id: false, strict: 'throw' },
);
const schema = new mongoose.Schema<EvaluationAnswer>(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'EvaluationAttempt',
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'EvaluationQuestion',
    },
    selectedOptionIds: { type: [String], required: true, default: [] },
    awardedPoints: Number,
    snapshot: { type: snapshotSchema, required: true },
  },
  { collection: 'evaluation_answers', strict: 'throw', timestamps: true },
);
schema.index(
  { attemptId: 1, questionId: 1 },
  { unique: true, name: 'unique_answer_per_attempt_question' },
);
export const EvaluationAnswerModel =
  (mongoose.models.EvaluationAnswer as Model<EvaluationAnswer> | undefined) ??
  mongoose.model<EvaluationAnswer>('EvaluationAnswer', schema);

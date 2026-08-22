import mongoose, { type Model, type Types } from 'mongoose';

export interface Feedback {
  enrollmentId: Types.ObjectId;
  trainingId: Types.ObjectId;
  learnerId: Types.ObjectId;
  rating: number;
  createdAt: Date;
}

const feedbackSchema = new mongoose.Schema<Feedback>(
  {
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Enrollment',
      immutable: true,
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
      immutable: true,
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isSafeInteger,
      immutable: true,
    },
  },
  {
    collection: 'feedback',
    strict: 'throw',
    timestamps: { createdAt: true, updatedAt: false },
  },
);

feedbackSchema.index(
  { enrollmentId: 1 },
  { unique: true, name: 'one_feedback_per_enrollment' },
);
feedbackSchema.index(
  { trainingId: 1, rating: 1 },
  { name: 'training_feedback_distribution' },
);
feedbackSchema.index(
  { learnerId: 1, createdAt: -1 },
  { name: 'learner_feedback_history' },
);

export const FeedbackModel =
  (mongoose.models.Feedback as Model<Feedback> | undefined) ??
  mongoose.model<Feedback>('Feedback', feedbackSchema);

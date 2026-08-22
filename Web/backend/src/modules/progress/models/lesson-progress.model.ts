import mongoose, { type Model, type Types } from 'mongoose';

export interface LessonProgress {
  enrollmentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  trainingId: Types.ObjectId;
  lessonId: Types.ObjectId;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const lessonProgressSchema = new mongoose.Schema<LessonProgress>(
  {
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
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Lesson',
    },
    completed: { type: Boolean, required: true, default: false },
    completedAt: { type: Date, default: null },
  },
  {
    collection: 'lesson_progress',
    strict: 'throw',
    timestamps: true,
  },
);

lessonProgressSchema.index(
  { enrollmentId: 1, lessonId: 1 },
  { unique: true, name: 'unique_enrollment_lesson_progress' },
);
lessonProgressSchema.index(
  { learnerId: 1, trainingId: 1, completed: 1 },
  { name: 'learner_training_progress' },
);

export const LessonProgressModel =
  (mongoose.models.LessonProgress as Model<LessonProgress> | undefined) ??
  mongoose.model<LessonProgress>('LessonProgress', lessonProgressSchema);

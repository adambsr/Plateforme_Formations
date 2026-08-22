import mongoose, { type Model, type Types } from 'mongoose';

export interface Lesson {
  trainingId: Types.ObjectId;
  moduleId: Types.ObjectId;
  title: string;
  description: string;
  textContent: string;
  instructions: string;
  order: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new mongoose.Schema<Lesson>(
  {
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'TrainingModule',
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2_000,
      default: '',
    },
    textContent: {
      type: String,
      maxlength: 100_000,
      default: '',
    },
    instructions: {
      type: String,
      maxlength: 10_000,
      default: '',
    },
    order: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    isArchived: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'lessons',
    strict: 'throw',
    timestamps: true,
  },
);

lessonSchema.index(
  { moduleId: 1, order: 1 },
  { unique: true, name: 'unique_lesson_order_per_module' },
);
lessonSchema.index(
  { trainingId: 1, moduleId: 1, isArchived: 1, order: 1 },
  { name: 'training_lesson_content' },
);

export const LessonModel =
  (mongoose.models.Lesson as Model<Lesson> | undefined) ??
  mongoose.model<Lesson>('Lesson', lessonSchema);

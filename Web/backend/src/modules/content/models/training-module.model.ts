import mongoose, { type Model, type Types } from 'mongoose';

export interface TrainingModule {
  trainingId: Types.ObjectId;
  title: string;
  description: string;
  order: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trainingModuleSchema = new mongoose.Schema<TrainingModule>(
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
    description: {
      type: String,
      trim: true,
      maxlength: 2_000,
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
    collection: 'training_modules',
    strict: 'throw',
    timestamps: true,
  },
);

trainingModuleSchema.index(
  { trainingId: 1, order: 1 },
  { unique: true, name: 'unique_module_order_per_training' },
);
trainingModuleSchema.index(
  { trainingId: 1, isArchived: 1, order: 1 },
  { name: 'training_module_content' },
);

export const TrainingModuleModel =
  (mongoose.models.TrainingModule as Model<TrainingModule> | undefined) ??
  mongoose.model<TrainingModule>('TrainingModule', trainingModuleSchema);

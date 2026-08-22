import mongoose, { type Model } from 'mongoose';

export interface TrainingCategory {
  name: string;
  normalizedName: string;
  description?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const trainingCategorySchema = new mongoose.Schema<TrainingCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      select: false,
    },
    description: { type: String, trim: true, maxlength: 1_000 },
    isArchived: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'training_categories',
    strict: 'throw',
    timestamps: true,
  },
);

trainingCategorySchema.index(
  { normalizedName: 1 },
  { unique: true, name: 'unique_training_category_name' },
);
trainingCategorySchema.index(
  { isArchived: 1, name: 1 },
  { name: 'training_category_catalogue' },
);

export const TrainingCategoryModel =
  (mongoose.models.TrainingCategory as Model<TrainingCategory> | undefined) ??
  mongoose.model<TrainingCategory>('TrainingCategory', trainingCategorySchema);

import mongoose, { type Model, type Types } from 'mongoose';

import { RESOURCE_TYPES, type ResourceType } from '../domain/content.js';

export interface StoredTrainingFile {
  originalName: string;
  storageName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  uploadedById: Types.ObjectId;
  uploadedAt: Date;
}

export interface TrainingResource {
  trainingId: Types.ObjectId;
  lessonId: Types.ObjectId;
  title: string;
  description: string;
  order: number;
  type: ResourceType;
  isVisibleToLearners: boolean;
  externalUrl?: string;
  file?: StoredTrainingFile;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storedFileSchema = new mongoose.Schema<StoredTrainingFile>(
  {
    originalName: { type: String, required: true, maxlength: 255 },
    storageName: { type: String, required: true },
    relativePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    checksumSha256: { type: String, required: true, match: /^[a-f\d]{64}$/ },
    uploadedById: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    uploadedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' },
);

const trainingResourceSchema = new mongoose.Schema<TrainingResource>(
  {
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
    type: { type: String, required: true, enum: RESOURCE_TYPES },
    isVisibleToLearners: { type: Boolean, required: true, default: true },
    externalUrl: { type: String },
    file: { type: storedFileSchema },
    isArchived: { type: Boolean, required: true, default: false },
  },
  {
    collection: 'training_resources',
    strict: 'throw',
    timestamps: true,
  },
);

trainingResourceSchema.index(
  { lessonId: 1, order: 1 },
  { unique: true, name: 'unique_resource_order_per_lesson' },
);
trainingResourceSchema.index(
  { trainingId: 1, lessonId: 1, isArchived: 1, order: 1 },
  { name: 'training_resource_content' },
);
trainingResourceSchema.index(
  { 'file.relativePath': 1 },
  {
    unique: true,
    sparse: true,
    name: 'unique_training_resource_file_path',
  },
);

export const TrainingResourceModel =
  (mongoose.models.TrainingResource as Model<TrainingResource> | undefined) ??
  mongoose.model<TrainingResource>('TrainingResource', trainingResourceSchema);

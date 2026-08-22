import mongoose, { type Model, type Types } from 'mongoose';

export interface TrainerCost {
  trainerId: Types.ObjectId;
  year: number;
  month: number;
  amountMinor: number;
  currency: 'TND';
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<TrainerCost>(
  {
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
      validate: Number.isSafeInteger,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      validate: Number.isSafeInteger,
    },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, required: true, enum: ['TND'], default: 'TND' },
    note: { type: String, trim: true, minlength: 1, maxlength: 1_000 },
  },
  { collection: 'trainer_costs', strict: 'throw', timestamps: true },
);

schema.index(
  { trainerId: 1, year: 1, month: 1 },
  { unique: true, name: 'one_monthly_cost_per_trainer' },
);
schema.index(
  { year: 1, month: 1, trainerId: 1 },
  { name: 'trainer_cost_calendar' },
);

export const TrainerCostModel =
  (mongoose.models.TrainerCost as Model<TrainerCost> | undefined) ??
  mongoose.model<TrainerCost>('TrainerCost', schema);

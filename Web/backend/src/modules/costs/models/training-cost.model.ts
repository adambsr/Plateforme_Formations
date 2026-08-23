import mongoose, { type Model, type Types } from 'mongoose';

export interface TrainingCost {
  trainingId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  incurredOn: Date;
  amountMinor: number;
  currency: 'EUR';
  label: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema<TrainingCost>(
  {
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
    },
    incurredOn: { type: Date, required: true },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, required: true, enum: ['EUR'], default: 'EUR' },
    label: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
  },
  { collection: 'training_costs', strict: 'throw', timestamps: true },
);

schema.index(
  { incurredOn: 1, trainingId: 1 },
  { name: 'training_cost_period' },
);
schema.index(
  { trainingId: 1, sessionId: 1, incurredOn: -1 },
  { name: 'training_cost_target' },
);

export const TrainingCostModel =
  (mongoose.models.TrainingCost as Model<TrainingCost> | undefined) ??
  mongoose.model<TrainingCost>('TrainingCost', schema);

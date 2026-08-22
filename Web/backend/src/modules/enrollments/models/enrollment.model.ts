import mongoose, { type Model, type Types } from 'mongoose';

export interface Enrollment {
  learnerId: Types.ObjectId;
  trainingId: Types.ObjectId;
  sessionId?: Types.ObjectId | null;
  paymentId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new mongoose.Schema<Enrollment>(
  {
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
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
      default: null,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Payment',
    },
  },
  {
    collection: 'enrollments',
    strict: 'throw',
    timestamps: true,
  },
);

enrollmentSchema.index(
  { paymentId: 1 },
  { unique: true, name: 'one_enrollment_per_paid_payment' },
);
enrollmentSchema.index(
  { learnerId: 1, trainingId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: null },
    name: 'unique_self_paced_enrollment',
  },
);
enrollmentSchema.index(
  { learnerId: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { sessionId: { $type: 'objectId' } },
    name: 'unique_in_person_enrollment',
  },
);
enrollmentSchema.index(
  { trainingId: 1, sessionId: 1, createdAt: -1 },
  { name: 'target_enrollments' },
);

export const EnrollmentModel =
  (mongoose.models.Enrollment as Model<Enrollment> | undefined) ??
  mongoose.model<Enrollment>('Enrollment', enrollmentSchema);

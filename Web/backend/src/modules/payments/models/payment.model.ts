import mongoose, { type Model, type Types } from 'mongoose';

import {
  PAYMENT_STATUSES,
  type PaymentStatus,
  type PurchaseType,
} from '../domain/payment.js';

export interface Payment {
  learnerId: Types.ObjectId;
  trainingId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  purchaseType: PurchaseType;
  status: PaymentStatus;
  amountMinor: number;
  currency: 'TND';
  trainingTitle: string;
  sessionTitle?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  lastStripeEventId?: string;
  failureCode?: string;
  failureMessage?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new mongoose.Schema<Payment>(
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
    },
    purchaseType: {
      type: String,
      required: true,
      enum: ['SELF_PACED_ONLINE', 'IN_PERSON'],
    },
    status: { type: String, required: true, enum: PAYMENT_STATUSES },
    amountMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, required: true, enum: ['TND'] },
    trainingTitle: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 200,
    },
    sessionTitle: { type: String, minlength: 1, maxlength: 200 },
    stripeCheckoutSessionId: { type: String, minlength: 1 },
    stripePaymentIntentId: { type: String, minlength: 1 },
    lastStripeEventId: { type: String, minlength: 1 },
    failureCode: { type: String, minlength: 1, maxlength: 100 },
    failureMessage: { type: String, minlength: 1, maxlength: 500 },
    paidAt: { type: Date },
  },
  {
    collection: 'payments',
    strict: 'throw',
    timestamps: true,
  },
);

paymentSchema.index(
  { stripeCheckoutSessionId: 1 },
  {
    unique: true,
    partialFilterExpression: { stripeCheckoutSessionId: { $type: 'string' } },
    name: 'unique_stripe_checkout_session',
  },
);
paymentSchema.index(
  { learnerId: 1, createdAt: -1 },
  { name: 'learner_payments' },
);
paymentSchema.index(
  { status: 1, paidAt: -1 },
  { name: 'payment_financial_status' },
);
paymentSchema.index(
  { trainingId: 1, sessionId: 1, status: 1 },
  { name: 'payment_purchase_target' },
);

export const PaymentModel =
  (mongoose.models.Payment as Model<Payment> | undefined) ??
  mongoose.model<Payment>('Payment', paymentSchema);

import mongoose, { type Model, type Types } from 'mongoose';

export interface LearnerInvoiceSnapshot {
  email: string;
  firstName: string;
  lastName: string;
}

export interface IssuerInvoiceSnapshot {
  name: string;
  address: string;
  email: string;
  phone?: string;
  registrationId?: string;
  logoPath?: string;
}

export interface InvoicePdf {
  relativePath: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  checksumSha256: string;
  generatedAt: Date;
}

export interface Invoice {
  paymentId: Types.ObjectId;
  enrollmentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  trainingId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  number: string;
  issuedAt: Date;
  learner: LearnerInvoiceSnapshot;
  issuer: IssuerInvoiceSnapshot;
  purchaseDescription: string;
  subtotalMinor: number;
  totalMinor: number;
  currency: 'EUR';
  pdf?: InvoicePdf;
  createdAt: Date;
  updatedAt: Date;
}

const learnerSnapshotSchema = new mongoose.Schema<LearnerInvoiceSnapshot>(
  {
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
  },
  { _id: false, strict: 'throw' },
);

const issuerSnapshotSchema = new mongoose.Schema<IssuerInvoiceSnapshot>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    registrationId: { type: String },
    logoPath: { type: String },
  },
  { _id: false, strict: 'throw' },
);

const invoicePdfSchema = new mongoose.Schema<InvoicePdf>(
  {
    relativePath: { type: String, required: true },
    mimeType: { type: String, required: true, enum: ['application/pdf'] },
    sizeBytes: { type: Number, required: true, min: 1 },
    checksumSha256: {
      type: String,
      required: true,
      match: /^[a-f\d]{64}$/,
    },
    generatedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' },
);

const invoiceSchema = new mongoose.Schema<Invoice>(
  {
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Payment',
    },
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
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
    },
    number: { type: String, required: true, minlength: 1, maxlength: 80 },
    issuedAt: { type: Date, required: true },
    learner: { type: learnerSnapshotSchema, required: true },
    issuer: { type: issuerSnapshotSchema, required: true },
    purchaseDescription: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 500,
    },
    subtotalMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    totalMinor: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },
    currency: { type: String, required: true, enum: ['EUR'] },
    pdf: { type: invoicePdfSchema },
  },
  {
    collection: 'invoices',
    strict: 'throw',
    timestamps: true,
  },
);

invoiceSchema.index(
  { paymentId: 1 },
  { unique: true, name: 'one_invoice_per_paid_payment' },
);
invoiceSchema.index(
  { enrollmentId: 1 },
  { unique: true, name: 'one_invoice_per_enrollment' },
);
invoiceSchema.index(
  { number: 1 },
  { unique: true, name: 'unique_invoice_number' },
);
invoiceSchema.index(
  { learnerId: 1, issuedAt: -1 },
  { name: 'learner_invoices' },
);

export const InvoiceModel =
  (mongoose.models.Invoice as Model<Invoice> | undefined) ??
  mongoose.model<Invoice>('Invoice', invoiceSchema);

import mongoose, { type Model, type Types } from 'mongoose';

export interface CertificateLearnerSnapshot {
  email: string;
  firstName: string;
  lastName: string;
}
export interface CertificateIssuerSnapshot {
  name: string;
  address: string;
  email: string;
  phone?: string;
  registrationId?: string;
  logoPath?: string;
}
export interface CertificateTrainingSnapshot {
  title: string;
  type: 'SELF_PACED_ONLINE' | 'IN_PERSON';
  durationMinutes: number;
  enrolledAt: Date;
  sessionTitle?: string;
  startsAt?: Date;
  endsAt?: Date;
}
export interface CertificateEligibilitySnapshot {
  completionPercentage: number;
  completedAt: Date;
  certifyingEvaluationId?: Types.ObjectId;
  passedAttemptId?: Types.ObjectId;
  passedAt?: Date;
}
export interface CertificatePdf {
  relativePath: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  checksumSha256: string;
  generatedAt: Date;
}
export interface Certificate {
  enrollmentId: Types.ObjectId;
  learnerId: Types.ObjectId;
  trainingId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  number: string;
  issuedAt: Date;
  learner: CertificateLearnerSnapshot;
  training: CertificateTrainingSnapshot;
  eligibility: CertificateEligibilitySnapshot;
  issuer: CertificateIssuerSnapshot;
  pdf?: CertificatePdf;
  createdAt: Date;
  updatedAt: Date;
}

const learnerSchema = new mongoose.Schema<CertificateLearnerSnapshot>(
  {
    email: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
  },
  { _id: false, strict: 'throw' },
);
const issuerSchema = new mongoose.Schema<CertificateIssuerSnapshot>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    registrationId: String,
    logoPath: String,
  },
  { _id: false, strict: 'throw' },
);
const trainingSnapshotSchema = new mongoose.Schema<CertificateTrainingSnapshot>(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['SELF_PACED_ONLINE', 'IN_PERSON'],
    },
    durationMinutes: { type: Number, required: true, min: 1 },
    enrolledAt: { type: Date, required: true },
    sessionTitle: String,
    startsAt: Date,
    endsAt: Date,
  },
  { _id: false, strict: 'throw' },
);
const eligibilitySchema = new mongoose.Schema<CertificateEligibilitySnapshot>(
  {
    completionPercentage: { type: Number, required: true, min: 0, max: 100 },
    completedAt: { type: Date, required: true },
    certifyingEvaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evaluation',
    },
    passedAttemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EvaluationAttempt',
    },
    passedAt: Date,
  },
  { _id: false, strict: 'throw' },
);
const pdfSchema = new mongoose.Schema<CertificatePdf>(
  {
    relativePath: { type: String, required: true },
    mimeType: { type: String, required: true, enum: ['application/pdf'] },
    sizeBytes: { type: Number, required: true, min: 1 },
    checksumSha256: { type: String, required: true, match: /^[a-f\d]{64}$/ },
    generatedAt: { type: Date, required: true },
  },
  { _id: false, strict: 'throw' },
);
const certificateSchema = new mongoose.Schema<Certificate>(
  {
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Enrollment',
      immutable: true,
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },
    trainingId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Training',
      immutable: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
      immutable: true,
    },
    number: { type: String, required: true, immutable: true },
    issuedAt: { type: Date, required: true, immutable: true },
    learner: { type: learnerSchema, required: true, immutable: true },
    training: { type: trainingSnapshotSchema, required: true, immutable: true },
    eligibility: { type: eligibilitySchema, required: true, immutable: true },
    issuer: { type: issuerSchema, required: true, immutable: true },
    pdf: { type: pdfSchema },
  },
  { collection: 'certificates', strict: 'throw', timestamps: true },
);
certificateSchema.index(
  { enrollmentId: 1 },
  { unique: true, name: 'one_certificate_per_enrollment' },
);
certificateSchema.index(
  { number: 1 },
  { unique: true, name: 'unique_certificate_number' },
);
certificateSchema.index(
  { learnerId: 1, issuedAt: -1 },
  { name: 'learner_certificates' },
);
certificateSchema.index(
  { trainingId: 1, issuedAt: -1 },
  { name: 'training_certificates' },
);
certificateSchema.index(
  { sessionId: 1, issuedAt: -1 },
  {
    name: 'session_certificates',
    partialFilterExpression: { sessionId: { $type: 'objectId' } },
  },
);

export const CertificateModel =
  (mongoose.models.Certificate as Model<Certificate> | undefined) ??
  mongoose.model<Certificate>('Certificate', certificateSchema);

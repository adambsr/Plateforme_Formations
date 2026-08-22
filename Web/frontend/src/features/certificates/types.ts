import type { Enrollment, Page } from '../payments/types.js';

export type { Enrollment, Page };

export interface Certificate {
  id: string;
  enrollmentId: string;
  learnerId: string;
  trainingId: string;
  sessionId?: string;
  number: string;
  issuedAt: string;
  learner: { email: string; firstName: string; lastName: string };
  training: {
    title: string;
    type: 'SELF_PACED_ONLINE' | 'IN_PERSON';
    durationMinutes: number;
    enrolledAt: string;
    sessionTitle?: string;
    startsAt?: string;
    endsAt?: string;
  };
  eligibility: {
    completionPercentage: number;
    completedAt: string;
    certifyingEvaluationId?: string;
    passedAttemptId?: string;
    passedAt?: string;
  };
  issuer: {
    name: string;
    address: string;
    email: string;
    phone?: string;
    registrationId?: string;
  };
  pdfDownloadUrl: string;
  createdAt: string;
}

export interface FeedbackSummary {
  count: number;
  average: number | null;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

export interface FeedbackStatistics {
  global: FeedbackSummary;
  byTraining: Array<
    FeedbackSummary & { training: { id: string; title: string } }
  >;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface Payment {
  id: string;
  training: { id: string; title: string };
  session?: { id: string; title: string };
  purchaseType: 'SELF_PACED_ONLINE' | 'IN_PERSON';
  status: PaymentStatus;
  amountMinor: number;
  currency: 'EUR';
  failure?: { code: string; message: string };
  enrollmentId?: string;
  invoiceId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  learner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  training: { id: string; title: string };
  session?: { id: string; title: string };
  payment: { id: string; amountMinor: number; currency: 'EUR' };
  feedback?: { rating: number; createdAt: string };
  eligibility?: { eligible: boolean; failures: string[] };
  createdAt: string;
}

export interface Invoice {
  id: string;
  paymentId: string;
  enrollmentId: string;
  number: string;
  issuedAt: string;
  purchaseDescription: string;
  totalMinor: number;
  currency: 'EUR';
  pdfDownloadUrl: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CheckoutResponse {
  payment: Payment;
  checkoutUrl: string;
}

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';

export interface Payment {
  id: string;
  training: { id: string; title: string };
  session?: { id: string; title: string };
  purchaseType: 'SELF_PACED_ONLINE' | 'IN_PERSON';
  status: PaymentStatus;
  amountMinor: number;
  currency: 'TND';
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
  payment: { id: string; amountMinor: number; currency: 'TND' };
  createdAt: string;
}

export interface Invoice {
  id: string;
  paymentId: string;
  enrollmentId: string;
  number: string;
  issuedAt: string;
  learner: { email: string; firstName: string; lastName: string };
  issuer: {
    name: string;
    address: string;
    email: string;
    phone?: string;
    registrationId?: string;
  };
  purchaseDescription: string;
  subtotalMinor: number;
  totalMinor: number;
  currency: 'TND';
  item: {
    id: string;
    description: string;
    quantity: 1;
    unitAmountMinor: number;
    totalMinor: number;
    currency: 'TND';
  };
  pdfDownloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

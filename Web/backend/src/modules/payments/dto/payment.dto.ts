import { z } from 'zod';

import { PAYMENT_STATUSES } from '../domain/payment.js';

export const paymentIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const checkoutRequestSchema = z
  .object({
    trainingId: paymentIdSchema,
    sessionId: paymentIdSchema.optional(),
    client: z.enum(['WEB', 'MOBILE']).default('WEB'),
  })
  .strict();

export const paymentListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PAYMENT_STATUSES).optional(),
});

export const enrollmentListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  trainingId: paymentIdSchema.optional(),
  sessionId: paymentIdSchema.optional(),
});

export const invoiceListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type PaymentListInput = z.infer<typeof paymentListSchema>;
export type EnrollmentListInput = z.infer<typeof enrollmentListSchema>;
export type InvoiceListInput = z.infer<typeof invoiceListSchema>;

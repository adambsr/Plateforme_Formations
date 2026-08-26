import { describe, expect, it } from 'vitest';

import { checkoutRequestSchema } from '../src/modules/payments/dto/payment.dto.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
import { InvoiceItemModel } from '../src/modules/invoices/models/invoice-item.model.js';
import { InvoiceModel } from '../src/modules/invoices/models/invoice.model.js';
import { PAYMENT_STATUSES } from '../src/modules/payments/domain/payment.js';
import { PaymentModel } from '../src/modules/payments/models/payment.model.js';
import { mobileCheckoutReturnUrls } from '../src/modules/payments/services/payment.service.js';

describe('Phase 5 persistence and request boundaries', () => {
  it('uses only the four authoritative Payment statuses', () => {
    expect(PAYMENT_STATUSES).toEqual([
      'PENDING',
      'PAID',
      'FAILED',
      'CANCELLED',
    ]);
  });

  it('rejects client-supplied price and payment state', () => {
    expect(
      checkoutRequestSchema.safeParse({
        trainingId: '507f1f77bcf86cd799439011',
        amountMinor: 1,
      }).success,
    ).toBe(false);
  });

  it('defaults Checkout to Web and selects stable Mobile deep-link returns', () => {
    expect(
      checkoutRequestSchema.parse({
        trainingId: '507f1f77bcf86cd799439011',
      }),
    ).toEqual({
      trainingId: '507f1f77bcf86cd799439011',
      client: 'WEB',
    });
    expect(mobileCheckoutReturnUrls('plateforme-formations')).toEqual({
      success: 'plateforme-formations://payments/success',
      cancel: 'plateforme-formations://payments/cancel',
    });
  });

  it('declares Stripe, Enrollment, Invoice, and one-line cardinality indexes', () => {
    expect(
      PaymentModel.schema
        .indexes()
        .some(([fields, options]) =>
          Boolean(
            fields['stripeCheckoutSessionId'] === 1 && options.unique === true,
          ),
        ),
    ).toBe(true);
    expect(
      EnrollmentModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['paymentId'] === 1 && options.unique === true,
        ),
    ).toBe(true);
    expect(
      InvoiceModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['paymentId'] === 1 && options.unique === true,
        ),
    ).toBe(true);
    expect(
      InvoiceItemModel.schema
        .indexes()
        .some(
          ([fields, options]) =>
            fields['invoiceId'] === 1 && options.unique === true,
        ),
    ).toBe(true);
  });
});

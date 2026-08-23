import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { StripeSdkCheckoutGateway } from './stripe-checkout-gateway.js';

describe('StripeSdkCheckoutGateway configuration', () => {
  it('returns an actionable French error before calling Stripe with placeholders', async () => {
    const gateway = new StripeSdkCheckoutGateway({
      secretKey: 'sk_test_replace_me',
      webhookSecret: 'whsec_replace_me',
      successUrl: 'http://localhost:5173/payments/success',
      cancelUrl: 'http://localhost:5173/payments/cancel',
    });

    await expect(
      gateway.createHostedCheckout({
        paymentId: 'payment-id',
        learnerId: 'learner-id',
        learnerEmail: 'learner@example.com',
        trainingId: 'training-id',
        description: 'Formation de test',
        amountMinor: 12_550,
        currency: 'TND',
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'STRIPE_CONFIGURATION_REQUIRED',
      message:
        'Le paiement en ligne n’est pas encore configuré. Renseignez les identifiants Stripe de test du backend.',
    });
  });

  it('rejects a live key before any Stripe call in development', async () => {
    const gateway = new StripeSdkCheckoutGateway(
      {
        secretKey: 'sk_live_not-a-real-key',
        webhookSecret: 'whsec_configured',
        successUrl: 'http://localhost:5173/payments/success',
        cancelUrl: 'http://localhost:5173/payments/cancel',
      },
      { nodeEnv: 'development', logger: pino({ enabled: false }) },
    );

    await expect(
      gateway.createHostedCheckout({
        paymentId: 'payment-id',
        learnerId: 'learner-id',
        learnerEmail: 'learner@example.com',
        trainingId: 'training-id',
        description: 'Formation de test',
        amountMinor: 15_000,
        currency: 'TND',
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: 'STRIPE_TEST_KEY_REQUIRED',
    });
  });
});

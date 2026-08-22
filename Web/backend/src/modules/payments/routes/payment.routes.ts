import express, { Router, type RequestHandler } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import { rateLimit } from '../../../middleware/rate-limit.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  checkoutRequestSchema,
  paymentIdSchema,
  paymentListSchema,
} from '../dto/payment.dto.js';
import type { PaymentService } from '../services/payment.service.js';

export function stripeWebhookMiddleware(): RequestHandler {
  return express.raw({ type: 'application/json', limit: '2mb' });
}

export function createStripeWebhookHandler(
  paymentService: PaymentService,
): RequestHandler {
  return async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(
        400,
        'STRIPE_RAW_BODY_REQUIRED',
        'The Stripe webhook requires an unmodified raw body.',
      );
    }
    await paymentService.handleWebhook(
      request.body,
      request.headers['stripe-signature'],
    );
    response.json({ received: true });
  };
}

export function createPaymentRouter(
  paymentService: PaymentService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const authenticated = authenticate(tokenService);
  const ready = [authenticated, requirePasswordChanged] as const;

  router.post(
    '/payments/checkout',
    ...ready,
    requireRoles('LEARNER'),
    rateLimit('checkout', 20),
    async (request, response) => {
      response
        .status(201)
        .json(
          await paymentService.createCheckout(
            authenticatedPrincipal(request),
            checkoutRequestSchema.parse(request.body),
          ),
        );
    },
  );
  router.get('/payments', ...ready, async (request, response) => {
    response.json(
      await paymentService.list(
        authenticatedPrincipal(request),
        paymentListSchema.parse(request.query),
      ),
    );
  });
  router.get('/payments/:id', ...ready, async (request, response) => {
    response.json(
      await paymentService.get(
        authenticatedPrincipal(request),
        paymentIdSchema.parse(request.params.id),
      ),
    );
  });
  return router;
}

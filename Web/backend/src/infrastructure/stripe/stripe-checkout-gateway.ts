import Stripe from 'stripe';

import type { AppConfig } from '../../config/environment.js';
import { AppError } from '../../shared/errors/app-error.js';

export interface CreateHostedCheckoutInput {
  paymentId: string;
  learnerId: string;
  learnerEmail: string;
  trainingId: string;
  sessionId?: string;
  description: string;
  amountMinor: number;
  currency: 'TND';
}

export interface HostedCheckout {
  id: string;
  url: string;
}

export type StripeCheckoutEvent =
  | {
      kind: 'SUCCEEDED';
      eventId: string;
      checkoutSessionId: string;
      paymentId: string;
      learnerId: string;
      trainingId: string;
      sessionId?: string;
      amountTotal: number;
      currency: string;
      paymentIntentId?: string;
    }
  | {
      kind: 'FAILED';
      eventId: string;
      checkoutSessionId: string;
      paymentId: string;
    }
  | {
      kind: 'CANCELLED';
      eventId: string;
      checkoutSessionId: string;
      paymentId: string;
    }
  | { kind: 'IGNORED'; eventId: string };

export interface StripeCheckoutGateway {
  createHostedCheckout(
    input: CreateHostedCheckoutInput,
  ): Promise<HostedCheckout>;
  constructWebhookEvent(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): StripeCheckoutEvent;
}

function referencedId(
  value: string | Stripe.PaymentIntent | null,
): string | undefined {
  if (value === null) return undefined;
  return typeof value === 'string' ? value : value.id;
}

export class StripeSdkCheckoutGateway implements StripeCheckoutGateway {
  readonly #stripe: Stripe;
  readonly #webhookSecret: string;
  readonly #successUrl: string;
  readonly #cancelUrl: string;

  constructor(config: AppConfig['stripe']) {
    this.#stripe = new Stripe(config.secretKey);
    this.#webhookSecret = config.webhookSecret;
    this.#successUrl = config.successUrl;
    this.#cancelUrl = config.cancelUrl;
  }

  async createHostedCheckout(
    input: CreateHostedCheckoutInput,
  ): Promise<HostedCheckout> {
    const metadata = {
      paymentId: input.paymentId,
      learnerId: input.learnerId,
      trainingId: input.trainingId,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    };
    const separator = this.#successUrl.includes('?') ? '&' : '?';
    const cancelSeparator = this.#cancelUrl.includes('?') ? '&' : '?';
    const session = await this.#stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: input.paymentId,
      customer_email: input.learnerEmail,
      success_url: `${this.#successUrl}${separator}paymentId=${input.paymentId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.#cancelUrl}${cancelSeparator}paymentId=${input.paymentId}`,
      metadata,
      payment_intent_data: { metadata },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountMinor,
            product_data: { name: input.description },
          },
        },
      ],
    });
    if (session.url === null) {
      throw new AppError(
        502,
        'STRIPE_CHECKOUT_URL_MISSING',
        'Stripe did not return a hosted Checkout URL.',
      );
    }
    return { id: session.id, url: session.url };
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): StripeCheckoutEvent {
    if (typeof signature !== 'string') {
      throw new AppError(
        400,
        'STRIPE_SIGNATURE_REQUIRED',
        'The Stripe signature header is required.',
      );
    }
    let event: Stripe.Event;
    try {
      event = this.#stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.#webhookSecret,
      );
    } catch {
      throw new AppError(
        400,
        'INVALID_STRIPE_SIGNATURE',
        'The Stripe webhook signature is invalid.',
      );
    }
    if (
      event.type !== 'checkout.session.completed' &&
      event.type !== 'checkout.session.async_payment_succeeded' &&
      event.type !== 'checkout.session.async_payment_failed' &&
      event.type !== 'checkout.session.expired'
    ) {
      return { kind: 'IGNORED', eventId: event.id };
    }
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId === undefined) {
      throw new AppError(
        400,
        'STRIPE_PAYMENT_REFERENCE_MISSING',
        'The Stripe event has no internal Payment reference.',
      );
    }
    if (event.type === 'checkout.session.expired') {
      return {
        kind: 'CANCELLED',
        eventId: event.id,
        checkoutSessionId: session.id,
        paymentId,
      };
    }
    if (event.type === 'checkout.session.async_payment_failed') {
      return {
        kind: 'FAILED',
        eventId: event.id,
        checkoutSessionId: session.id,
        paymentId,
      };
    }
    if (session.payment_status !== 'paid') {
      return { kind: 'IGNORED', eventId: event.id };
    }
    const { learnerId, trainingId, sessionId } = session.metadata ?? {};
    if (
      learnerId === undefined ||
      trainingId === undefined ||
      session.amount_total === null ||
      session.currency === null
    ) {
      throw new AppError(
        400,
        'STRIPE_PURCHASE_DATA_MISSING',
        'The Stripe event is missing trusted purchase data.',
      );
    }
    const paymentIntentId = referencedId(session.payment_intent);
    return {
      kind: 'SUCCEEDED',
      eventId: event.id,
      checkoutSessionId: session.id,
      paymentId,
      learnerId,
      trainingId,
      ...(sessionId === undefined ? {} : { sessionId }),
      amountTotal: session.amount_total,
      currency: session.currency,
      ...(paymentIntentId === undefined ? {} : { paymentIntentId }),
    };
  }
}

import Stripe from 'stripe';
import type { Logger } from 'pino';

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
  currency: 'EUR';
  returnUrls?: { success: string; cancel: string };
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
  readonly #configured: boolean;
  readonly #logger: Logger | undefined;
  readonly #rejectLiveKey: boolean;

  constructor(
    config: AppConfig['stripe'],
    runtime?: {
      nodeEnv: AppConfig['application']['nodeEnv'];
      logger: Logger;
    },
  ) {
    this.#stripe = new Stripe(config.secretKey);
    this.#webhookSecret = config.webhookSecret;
    this.#successUrl = config.successUrl;
    this.#cancelUrl = config.cancelUrl;
    this.#configured =
      !config.secretKey.toLowerCase().includes('replace') &&
      !config.webhookSecret.toLowerCase().includes('replace');
    this.#logger = runtime?.logger;
    this.#rejectLiveKey =
      runtime !== undefined &&
      runtime.nodeEnv !== 'production' &&
      config.secretKey.startsWith('sk_live_');
  }

  async createHostedCheckout(
    input: CreateHostedCheckoutInput,
  ): Promise<HostedCheckout> {
    if (!this.#configured) {
      throw new AppError(
        503,
        'STRIPE_CONFIGURATION_REQUIRED',
        'Le paiement en ligne n’est pas encore configuré. Renseignez les identifiants Stripe de test du backend.',
      );
    }
    if (this.#rejectLiveKey) {
      throw new AppError(
        503,
        'STRIPE_TEST_KEY_REQUIRED',
        'Le backend de développement doit utiliser la clé secrète sk_test_ de la Sandbox Stripe.',
      );
    }
    const metadata = {
      paymentId: input.paymentId,
      learnerId: input.learnerId,
      trainingId: input.trainingId,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    };
    const successUrl = input.returnUrls?.success ?? this.#successUrl;
    const cancelUrl = input.returnUrls?.cancel ?? this.#cancelUrl;
    const separator = successUrl.includes('?') ? '&' : '?';
    const cancelSeparator = cancelUrl.includes('?') ? '&' : '?';
    let session: Stripe.Checkout.Session;
    try {
      session = await this.#stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: input.paymentId,
        customer_email: input.learnerEmail,
        success_url: `${successUrl}${separator}paymentId=${input.paymentId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancelUrl}${cancelSeparator}paymentId=${input.paymentId}`,
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
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        this.#logger?.error(
          {
            stripeError: {
              type: error.type,
              code: error.code,
              param: error.param,
              requestId: error.requestId,
              statusCode: error.statusCode,
              message: error.message,
            },
            checkout: {
              currency: input.currency,
              amountMinor: input.amountMinor,
            },
          },
          'Stripe Checkout Session creation rejected',
        );
      }
      if (error instanceof Stripe.errors.StripeAuthenticationError) {
        throw new AppError(
          503,
          'STRIPE_CONFIGURATION_REQUIRED',
          'La configuration Stripe de test est invalide. Vérifiez la clé secrète du backend.',
        );
      }
      if (
        error instanceof Stripe.errors.StripeInvalidRequestError &&
        error.param?.endsWith('[currency]') === true &&
        /invalid currency:\s*eur/i.test(error.message)
      ) {
        throw new AppError(
          503,
          'STRIPE_EUR_NOT_ENABLED',
          'La Sandbox Stripe configurée refuse actuellement les paiements en EUR. Vérifiez que STRIPE_SECRET_KEY appartient à la Sandbox où le EUR est activé.',
        );
      }
      if (error instanceof Stripe.errors.StripeError) {
        throw new AppError(
          502,
          'STRIPE_CHECKOUT_FAILED',
          'Stripe a refusé la création de la session de paiement. Consultez le journal backend avec la référence de la requête.',
        );
      }
      throw error;
    }
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

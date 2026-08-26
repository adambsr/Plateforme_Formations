import mongoose, {
  type HydratedDocument,
  type QueryFilter,
  type Types,
} from 'mongoose';

import type { AppConfig } from '../../../config/environment.js';
import type {
  StripeCheckoutEvent,
  StripeCheckoutGateway,
} from '../../../infrastructure/stripe/stripe-checkout-gateway.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { InvoiceItemModel } from '../../invoices/models/invoice-item.model.js';
import { InvoiceModel } from '../../invoices/models/invoice.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type { CheckoutRequest, PaymentListInput } from '../dto/payment.dto.js';
import { PaymentModel, type Payment } from '../models/payment.model.js';

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

export function mobileCheckoutReturnUrls(mobileAppScheme: string) {
  return {
    success: `${mobileAppScheme}://payments/success`,
    cancel: `${mobileAppScheme}://payments/cancel`,
  } as const;
}

export class PaymentService {
  readonly #gateway: StripeCheckoutGateway;
  readonly #issuer: AppConfig['center'];
  readonly #mobileAppScheme: string;

  constructor(
    gateway: StripeCheckoutGateway,
    issuer: AppConfig['center'],
    mobileAppScheme = 'plateforme-formations',
  ) {
    this.#gateway = gateway;
    this.#issuer = issuer;
    this.#mobileAppScheme = mobileAppScheme;
  }

  async createCheckout(
    principal: AuthenticatedPrincipal,
    input: CheckoutRequest,
  ) {
    passwordReady(principal);
    if (principal.role !== 'LEARNER') {
      throw new AppError(
        403,
        'LEARNER_CHECKOUT_REQUIRED',
        'Only a Learner can purchase an Enrollment.',
      );
    }
    const [learner, training] = await Promise.all([
      UserModel.findById(principal.userId).exec(),
      TrainingModel.findOne({
        _id: input.trainingId,
        status: 'PUBLISHED',
      }).exec(),
    ]);
    if (learner === null || training === null) {
      throw new AppError(
        404,
        'PURCHASE_TARGET_NOT_FOUND',
        'The published Training does not exist.',
      );
    }
    if (
      !Number.isSafeInteger(training.priceMinor) ||
      training.priceMinor <= 0
    ) {
      throw new AppError(
        409,
        'INVALID_TRAINING_PRICE',
        'The Training does not have a valid payable EUR price.',
      );
    }

    let session: HydratedDocument<
      import('../../sessions/models/training-session.model.js').TrainingSession
    > | null = null;
    if (training.type === 'SELF_PACED_ONLINE') {
      if (input.sessionId !== undefined) {
        throw new AppError(
          422,
          'SESSION_NOT_ALLOWED',
          'A self-paced purchase cannot target a Session.',
        );
      }
      if (
        (await EnrollmentModel.exists({
          learnerId: learner._id,
          trainingId: training._id,
          sessionId: null,
        })) !== null
      ) {
        throw this.#duplicateEnrollment();
      }
    } else {
      if (input.sessionId === undefined) {
        throw new AppError(
          422,
          'SESSION_REQUIRED',
          'An in-person purchase requires a Session.',
        );
      }
      session = await TrainingSessionModel.findOne({
        _id: input.sessionId,
        trainingId: training._id,
        status: 'PLANNED',
        $expr: { $lt: ['$enrolledCount', '$capacity'] },
      }).exec();
      if (session === null) {
        throw new AppError(
          409,
          'SESSION_UNAVAILABLE',
          'The selected Session is not planned and available.',
        );
      }
      if (
        (await EnrollmentModel.exists({
          learnerId: learner._id,
          sessionId: session._id,
        })) !== null
      ) {
        throw this.#duplicateEnrollment();
      }
    }

    const payment = await PaymentModel.create({
      learnerId: learner._id,
      trainingId: training._id,
      ...(session === null ? {} : { sessionId: session._id }),
      purchaseType: training.type,
      status: 'PENDING',
      amountMinor: training.priceMinor,
      currency: 'EUR',
      trainingTitle: training.title,
      ...(session === null ? {} : { sessionTitle: session.title }),
    });
    try {
      const checkout = await this.#gateway.createHostedCheckout({
        paymentId: String(payment._id),
        learnerId: String(learner._id),
        learnerEmail: learner.email,
        trainingId: String(training._id),
        ...(session === null ? {} : { sessionId: String(session._id) }),
        description:
          session === null
            ? training.title
            : `${training.title} — ${session.title}`,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        ...(input.client === 'MOBILE'
          ? {
              returnUrls: mobileCheckoutReturnUrls(this.#mobileAppScheme),
            }
          : {}),
      });
      payment.stripeCheckoutSessionId = checkout.id;
      await payment.save();
      return {
        payment: await this.#view(payment),
        checkoutUrl: checkout.url,
      };
    } catch (error) {
      payment.status = 'FAILED';
      payment.failureCode =
        error instanceof AppError ? error.code : 'CHECKOUT_CREATION_FAILED';
      payment.failureMessage =
        error instanceof AppError
          ? error.message
          : 'Stripe Checkout creation failed.';
      await payment.save();
      if (error instanceof AppError) throw error;
      throw new AppError(
        502,
        'STRIPE_CHECKOUT_FAILED',
        'Stripe Checkout could not be created.',
      );
    }
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): Promise<void> {
    const event = this.#gateway.constructWebhookEvent(rawBody, signature);
    if (event.kind === 'IGNORED') return;
    if (event.kind === 'FAILED' || event.kind === 'CANCELLED') {
      await PaymentModel.updateOne(
        {
          _id: event.paymentId,
          stripeCheckoutSessionId: event.checkoutSessionId,
          status: 'PENDING',
        },
        {
          $set: {
            status: event.kind,
            lastStripeEventId: event.eventId,
            failureCode:
              event.kind === 'FAILED'
                ? 'STRIPE_PAYMENT_FAILED'
                : 'STRIPE_CHECKOUT_EXPIRED',
            failureMessage:
              event.kind === 'FAILED'
                ? 'Stripe reported that the payment failed.'
                : 'Stripe Checkout expired before payment.',
          },
        },
      );
      return;
    }
    await this.#assertTrustedSuccess(event);
    try {
      await this.#fulfill(event);
    } catch (error) {
      if (
        error instanceof AppError &&
        ['ENROLLMENT_ALREADY_EXISTS', 'SESSION_CAPACITY_REACHED'].includes(
          error.code,
        )
      ) {
        await PaymentModel.updateOne(
          { _id: event.paymentId, status: 'PENDING' },
          {
            $set: {
              status: 'FAILED',
              lastStripeEventId: event.eventId,
              failureCode: error.code,
              failureMessage: error.message,
              ...(event.paymentIntentId === undefined
                ? {}
                : { stripePaymentIntentId: event.paymentIntentId }),
            },
          },
        );
        return;
      }
      throw error;
    }
  }

  async list(principal: AuthenticatedPrincipal, input: PaymentListInput) {
    passwordReady(principal);
    this.#assertFinancialReader(principal);
    const filter: QueryFilter<Payment> = {
      ...(principal.role === 'LEARNER' ? { learnerId: principal.userId } : {}),
      ...(input.status === undefined ? {} : { status: input.status }),
    };
    const [payments, total] = await Promise.all([
      PaymentModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      PaymentModel.countDocuments(filter),
    ]);
    return {
      items: await Promise.all(payments.map((payment) => this.#view(payment))),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async get(principal: AuthenticatedPrincipal, paymentId: string) {
    passwordReady(principal);
    this.#assertFinancialReader(principal);
    const payment = await PaymentModel.findById(paymentId).exec();
    if (
      payment === null ||
      (principal.role === 'LEARNER' &&
        String(payment.learnerId) !== principal.userId)
    ) {
      throw new AppError(
        404,
        'PAYMENT_NOT_FOUND',
        'The Payment does not exist.',
      );
    }
    return await this.#view(payment);
  }

  async #assertTrustedSuccess(
    event: Extract<StripeCheckoutEvent, { kind: 'SUCCEEDED' }>,
  ): Promise<void> {
    const payment = await PaymentModel.findById(event.paymentId).exec();
    if (
      payment === null ||
      payment.stripeCheckoutSessionId !== event.checkoutSessionId ||
      String(payment.learnerId) !== event.learnerId ||
      String(payment.trainingId) !== event.trainingId ||
      (payment.sessionId === undefined
        ? undefined
        : String(payment.sessionId)) !== event.sessionId ||
      payment.amountMinor !== event.amountTotal ||
      event.currency.toUpperCase() !== payment.currency
    ) {
      throw new AppError(
        400,
        'STRIPE_PURCHASE_MISMATCH',
        'The verified Stripe purchase does not match the Payment snapshot.',
      );
    }
  }

  async #fulfill(
    event: Extract<StripeCheckoutEvent, { kind: 'SUCCEEDED' }>,
  ): Promise<void> {
    await mongoose.connection.transaction(async (databaseSession) => {
      const payment = await PaymentModel.findById(event.paymentId)
        .session(databaseSession)
        .exec();
      if (payment === null) {
        throw new AppError(
          404,
          'PAYMENT_NOT_FOUND',
          'The Payment does not exist.',
        );
      }
      if (payment.status === 'PAID') return;
      if (payment.status !== 'PENDING') {
        throw new AppError(
          409,
          'PAYMENT_NOT_PENDING',
          'Only a pending Payment can be fulfilled.',
        );
      }
      const equivalent = await EnrollmentModel.exists(
        payment.sessionId === undefined
          ? {
              learnerId: payment.learnerId,
              trainingId: payment.trainingId,
              sessionId: null,
            }
          : { learnerId: payment.learnerId, sessionId: payment.sessionId },
      ).session(databaseSession);
      if (equivalent !== null) throw this.#duplicateEnrollment();

      if (payment.sessionId !== undefined) {
        const updated = await TrainingSessionModel.findOneAndUpdate(
          {
            _id: payment.sessionId,
            status: { $ne: 'CANCELLED' },
            $expr: { $lt: ['$enrolledCount', '$capacity'] },
          },
          { $inc: { enrolledCount: 1 } },
          { returnDocument: 'after', session: databaseSession },
        ).exec();
        if (updated === null) {
          throw new AppError(
            409,
            'SESSION_CAPACITY_REACHED',
            'The Session reached capacity before payment fulfillment.',
          );
        }
      }

      const learner = await UserModel.findById(payment.learnerId)
        .session(databaseSession)
        .exec();
      if (learner === null)
        throw new Error('Payment Learner reference is inconsistent.');
      const [enrollment] = await EnrollmentModel.create(
        [
          {
            learnerId: payment.learnerId,
            trainingId: payment.trainingId,
            ...(payment.sessionId === undefined
              ? { sessionId: null }
              : { sessionId: payment.sessionId }),
            paymentId: payment._id,
          },
        ],
        { session: databaseSession },
      );
      if (enrollment === undefined)
        throw new Error('Enrollment was not created.');
      const issuedAt = new Date();
      const description =
        payment.sessionTitle === undefined
          ? payment.trainingTitle
          : `${payment.trainingTitle} — ${payment.sessionTitle}`;
      const [invoice] = await InvoiceModel.create(
        [
          {
            paymentId: payment._id,
            enrollmentId: enrollment._id,
            learnerId: payment.learnerId,
            trainingId: payment.trainingId,
            ...(payment.sessionId === undefined
              ? {}
              : { sessionId: payment.sessionId }),
            number: this.#invoiceNumber(payment._id, issuedAt),
            issuedAt,
            learner: {
              email: learner.email,
              firstName: learner.profile.firstName ?? '',
              lastName: learner.profile.lastName ?? '',
            },
            issuer: {
              name: this.#issuer.name,
              address: this.#issuer.address,
              email: this.#issuer.email,
              ...(this.#issuer.phone === undefined
                ? {}
                : { phone: this.#issuer.phone }),
              ...(this.#issuer.registrationId === undefined
                ? {}
                : { registrationId: this.#issuer.registrationId }),
              ...(this.#issuer.logoPath === undefined
                ? {}
                : { logoPath: this.#issuer.logoPath }),
            },
            purchaseDescription: description,
            subtotalMinor: payment.amountMinor,
            totalMinor: payment.amountMinor,
            currency: payment.currency,
          },
        ],
        { session: databaseSession },
      );
      if (invoice === undefined) throw new Error('Invoice was not created.');
      await InvoiceItemModel.create(
        [
          {
            invoiceId: invoice._id,
            description,
            quantity: 1,
            unitAmountMinor: payment.amountMinor,
            totalMinor: payment.amountMinor,
            currency: payment.currency,
          },
        ],
        { session: databaseSession },
      );
      payment.status = 'PAID';
      payment.paidAt = issuedAt;
      payment.lastStripeEventId = event.eventId;
      if (event.paymentIntentId !== undefined) {
        payment.stripePaymentIntentId = event.paymentIntentId;
      }
      await payment.save({ session: databaseSession });
    });
  }

  async #view(payment: HydratedDocument<Payment>) {
    const [enrollment, invoice] = await Promise.all([
      EnrollmentModel.findOne({ paymentId: payment._id })
        .select({ _id: 1 })
        .exec(),
      InvoiceModel.findOne({ paymentId: payment._id })
        .select({ _id: 1 })
        .exec(),
    ]);
    return {
      id: String(payment._id),
      training: {
        id: String(payment.trainingId),
        title: payment.trainingTitle,
      },
      ...(payment.sessionId === undefined
        ? {}
        : {
            session: {
              id: String(payment.sessionId),
              title: payment.sessionTitle as string,
            },
          }),
      purchaseType: payment.purchaseType,
      status: payment.status,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      ...(payment.failureCode === undefined
        ? {}
        : {
            failure: {
              code: payment.failureCode,
              message: payment.failureMessage ?? 'Payment processing failed.',
            },
          }),
      ...(enrollment === null ? {} : { enrollmentId: String(enrollment._id) }),
      ...(invoice === null ? {} : { invoiceId: String(invoice._id) }),
      ...(payment.paidAt === undefined
        ? {}
        : { paidAt: payment.paidAt.toISOString() }),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  #assertFinancialReader(principal: AuthenticatedPrincipal): void {
    if (principal.role === 'TRAINER') {
      throw new AppError(
        403,
        'FINANCIAL_ACCESS_FORBIDDEN',
        'Trainers do not have financial access.',
      );
    }
  }

  #duplicateEnrollment(): AppError {
    return new AppError(
      409,
      'ENROLLMENT_ALREADY_EXISTS',
      'An equivalent Enrollment already exists.',
    );
  }

  #invoiceNumber(paymentId: Types.ObjectId, issuedAt: Date): string {
    return `INV-${issuedAt.toISOString().slice(0, 10).replaceAll('-', '')}-${String(paymentId).slice(-8).toUpperCase()}`;
  }
}

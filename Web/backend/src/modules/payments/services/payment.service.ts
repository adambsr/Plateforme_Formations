import mongoose, {
  type HydratedDocument,
  type QueryFilter,
  type Types,
} from 'mongoose';
import type { Logger } from 'pino';

import type { AppConfig } from '../../../config/environment.js';
import { deliverBestEffort } from '../../../infrastructure/mail/email-delivery.js';
import type { TransactionalEmailService } from '../../../infrastructure/mail/email-service.js';
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
import type { NotificationService } from '../../notifications/services/notification.service.js';
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
    success: `intent://payments/success#Intent;scheme=${mobileAppScheme};end`,
    cancel: `intent://payments/cancel#Intent;scheme=${mobileAppScheme};end`,
  } as const;
}

export class PaymentService {
  readonly #gateway: StripeCheckoutGateway;
  readonly #issuer: AppConfig['center'];
  readonly #mobileAppScheme: string;
  readonly #mail: TransactionalEmailService;
  readonly #logger: Logger;
  readonly #notifications: NotificationService | undefined;

  constructor(
    gateway: StripeCheckoutGateway,
    issuer: AppConfig['center'],
    mail: TransactionalEmailService,
    logger: Logger,
    mobileAppScheme = 'plateforme-formations',
    notifications?: NotificationService,
  ) {
    this.#gateway = gateway;
    this.#issuer = issuer;
    this.#mail = mail;
    this.#logger = logger;
    this.#mobileAppScheme = mobileAppScheme;
    this.#notifications = notifications;
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
      await this.#notifyPaymentFailure(
        payment,
        `checkout:${String(payment._id)}`,
      );
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
      const update = await PaymentModel.updateOne(
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
      if (update.modifiedCount === 1) {
        const payment = await PaymentModel.findById(event.paymentId).exec();
        if (payment !== null)
          await this.#notifyPaymentFailure(payment, event.eventId);
      }
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
        const payment = await PaymentModel.findById(event.paymentId).exec();
        if (payment !== null)
          await this.#notifyPaymentFailure(payment, event.eventId);
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
    const confirmation = await mongoose.connection.transaction(
      async (databaseSession) => {
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
        if (payment.status === 'PAID') return undefined;
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
        return {
          paymentId: String(payment._id),
          learnerId: String(payment.learnerId),
          trainingId: String(payment.trainingId),
          ...(payment.sessionId === undefined
            ? {}
            : { sessionId: String(payment.sessionId) }),
          email: learner.email,
          ...(learner.profile.firstName === undefined
            ? {}
            : { firstName: learner.profile.firstName }),
          trainingTitle: payment.trainingTitle,
          ...(payment.sessionTitle === undefined
            ? {}
            : { sessionTitle: payment.sessionTitle }),
          amountMinor: payment.amountMinor,
          currency: payment.currency,
        };
      },
    );
    if (confirmation !== undefined) {
      await deliverBestEffort(
        this.#logger,
        'purchase-in-app-notifications',
        async () => {
          await this.#notifications?.createInApp({
            recipientUserId: confirmation.learnerId,
            type: 'PURCHASE_CONFIRMED',
            title: 'Formation achetée',
            message: `Votre inscription à « ${confirmation.trainingTitle} » a été confirmée.`,
            link: '/app/payments',
            dedupeKey: `payment-paid:${confirmation.paymentId}`,
            metadata: {
              paymentId: confirmation.paymentId,
              trainingId: confirmation.trainingId,
            },
          });
          await this.#notifications?.notifyAdmins({
            type: 'PAYMENT_RECEIVED',
            title: 'Paiement reçu',
            message: `Un paiement de ${(confirmation.amountMinor / 100).toLocaleString('fr-FR', { style: 'currency', currency: confirmation.currency })} a été confirmé pour « ${confirmation.trainingTitle} ».`,
            link: '/app/payments',
            dedupeKey: `payment-paid:${confirmation.paymentId}`,
            metadata: { paymentId: confirmation.paymentId },
          });
          await this.#notifications?.notifyAdmins({
            type: 'ENROLLMENT_CREATED',
            title: 'Nouvelle inscription',
            message: `Un apprenant s’est inscrit à « ${confirmation.trainingTitle} ».`,
            link: '/app/payments',
            dedupeKey: `enrollment:${confirmation.paymentId}`,
            metadata: {
              paymentId: confirmation.paymentId,
              learnerId: confirmation.learnerId,
              trainingId: confirmation.trainingId,
            },
          });
          const training = await TrainingModel.findById(confirmation.trainingId)
            .select({ ownerTrainerId: 1 })
            .lean()
            .exec();
          const trainerIds = new Set<string>();
          if (training !== null)
            trainerIds.add(String(training.ownerTrainerId));
          if (confirmation.sessionId !== undefined) {
            const session = await TrainingSessionModel.findById(
              confirmation.sessionId,
            )
              .select({ assignedTrainerIds: 1 })
              .lean()
              .exec();
            for (const id of session?.assignedTrainerIds ?? [])
              trainerIds.add(String(id));
          }
          await this.#notifications?.createMany(
            [...trainerIds].map((recipientUserId) => ({
              recipientUserId,
              type: 'LEARNER_ENROLLED',
              title: 'Nouvelle inscription',
              message: `Un nouvel apprenant s’est inscrit à « ${confirmation.trainingTitle} ».`,
              link: '/app/attendance',
              dedupeKey: `enrollment:${confirmation.paymentId}`,
              metadata: {
                paymentId: confirmation.paymentId,
                learnerId: confirmation.learnerId,
                trainingId: confirmation.trainingId,
              },
            })),
          );
        },
      );
      await deliverBestEffort(this.#logger, 'enrollment-confirmation', () =>
        this.#mail.sendEnrollmentConfirmation(confirmation),
      );
    }
  }

  async #notifyPaymentFailure(
    payment: HydratedDocument<Payment>,
    eventKey: string,
  ): Promise<void> {
    await deliverBestEffort(
      this.#logger,
      'payment-failure-notifications',
      async () => {
        await this.#notifications?.createInApp({
          recipientUserId: String(payment.learnerId),
          type: 'PAYMENT_FAILED',
          title: 'Paiement échoué',
          message: `Le paiement pour « ${payment.trainingTitle} » n’a pas pu être confirmé.`,
          link: '/app/payments',
          dedupeKey: `payment-failed:${String(payment._id)}:${eventKey}`,
          metadata: { paymentId: String(payment._id) },
        });
        await this.#notifications?.notifyAdmins({
          type: 'PAYMENT_FAILED',
          title: 'Paiement échoué',
          message: `Un paiement pour « ${payment.trainingTitle} » a échoué.`,
          link: '/app/payments',
          dedupeKey: `payment-failed:${String(payment._id)}:${eventKey}`,
          metadata: { paymentId: String(payment._id) },
        });
      },
    );
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

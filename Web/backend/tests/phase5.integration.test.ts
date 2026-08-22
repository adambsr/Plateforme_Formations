import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import mongoose, { type HydratedDocument } from 'mongoose';
import { PDFParse } from 'pdf-parse';
import pino from 'pino';
import request from 'supertest';
import Stripe from 'stripe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import {
  StripeSdkCheckoutGateway,
  type CreateHostedCheckoutInput,
  type HostedCheckout,
  type StripeCheckoutGateway,
} from '../src/infrastructure/stripe/stripe-checkout-gateway.js';
import type { PasswordResetMailService } from '../src/infrastructure/mail/password-reset-mail.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
import { InvoiceItemModel } from '../src/modules/invoices/models/invoice-item.model.js';
import { InvoiceModel } from '../src/modules/invoices/models/invoice.model.js';
import {
  PaymentModel,
  type Payment,
} from '../src/modules/payments/models/payment.model.js';
import { TrainingSessionModel } from '../src/modules/sessions/models/training-session.model.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import { hashPassword } from '../src/shared/auth/password.js';
import { validEnvironment } from './fixtures/environment.js';

const databaseUri = process.env.TEST_MONGODB_URI;
const integrationDescribe =
  databaseUri === undefined ? describe.skip : describe;

function requiredUri(): string {
  if (databaseUri === undefined)
    throw new Error('TEST_MONGODB_URI is required.');
  if (
    new URL(databaseUri).pathname.slice(1) !==
    'plateforme_formations_integration'
  ) {
    throw new Error(
      'TEST_MONGODB_URI must use plateforme_formations_integration.',
    );
  }
  return databaseUri;
}

class TestStripeGateway implements StripeCheckoutGateway {
  readonly #verifier: StripeSdkCheckoutGateway;

  constructor(config: ReturnType<typeof loadAppConfig>['stripe']) {
    this.#verifier = new StripeSdkCheckoutGateway(config);
  }

  async createHostedCheckout(
    input: CreateHostedCheckoutInput,
  ): Promise<HostedCheckout> {
    return {
      id: `cs_test_${input.paymentId}`,
      url: `https://checkout.stripe.test/${input.paymentId}`,
    };
  }

  constructWebhookEvent(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ) {
    return this.#verifier.constructWebhookEvent(rawBody, signature);
  }
}

integrationDescribe(
  'Phase 5 Stripe, Enrollment, and Invoice integration',
  () => {
    const webhookSecret = 'whsec_placeholder';
    const mailService: PasswordResetMailService = {
      async sendPasswordReset() {},
    };
    let uploadRoot = '';

    async function clean() {
      await Promise.all([
        InvoiceItemModel.deleteMany({}),
        InvoiceModel.deleteMany({}),
        EnrollmentModel.deleteMany({}),
        PaymentModel.deleteMany({}),
        mongoose.connection.collection('attendances').deleteMany({}),
        mongoose.connection.collection('lesson_progress').deleteMany({}),
        mongoose.connection.collection('resource_progress').deleteMany({}),
        mongoose.connection.collection('session_schedules').deleteMany({}),
        TrainingSessionModel.deleteMany({}),
        LessonModel.deleteMany({}),
        TrainingModuleModel.deleteMany({}),
        TrainingModel.deleteMany({}),
        TrainingCategoryModel.deleteMany({}),
        mongoose.connection.collection('password_reset_tokens').deleteMany({}),
        mongoose.connection.collection('refresh_sessions').deleteMany({}),
        UserModel.deleteMany({}),
      ]);
    }

    beforeAll(async () => {
      uploadRoot = await mkdtemp(path.join(tmpdir(), 'phase5-documents-'));
      await mongoose.connect(requiredUri());
      await clean();
      await initializeDatabaseIndexes();
    });

    beforeEach(async () => {
      await clean();
    });

    afterAll(async () => {
      if (mongoose.connection.readyState !== 0) {
        await clean();
        await mongoose.disconnect();
      }
      await rm(uploadRoot, { recursive: true, force: true });
    });

    async function setup() {
      const passwordHash = await hashPassword('Phase5-password-123!');
      const [admin, trainer, learner, secondLearner, thirdLearner] =
        await UserModel.create([
          {
            email: 'admin.phase5@example.com',
            passwordHash,
            role: 'ADMIN',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Admin', lastName: 'Finance' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'trainer.phase5@example.com',
            passwordHash,
            role: 'TRAINER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Nadia', lastName: 'Trainer' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'learner.phase5@example.com',
            passwordHash,
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Ali', lastName: 'Learner' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'second.phase5@example.com',
            passwordHash,
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Sana', lastName: 'Second' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'third.phase5@example.com',
            passwordHash,
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Omar', lastName: 'Third' },
            passwordChangedAt: new Date(),
          },
        ]);
      if (
        admin === undefined ||
        trainer === undefined ||
        learner === undefined ||
        secondLearner === undefined ||
        thirdLearner === undefined
      ) {
        throw new Error('Phase 5 users were not created.');
      }
      const category = await TrainingCategoryModel.create({
        name: 'Paiements',
        normalizedName: 'paiements',
        description: '',
        isArchived: false,
      });
      const common = {
        description: 'Formation achetée via Stripe test.',
        categoryId: category._id,
        level: 'Intermédiaire',
        durationMinutes: 300,
        objectives: [],
        prerequisites: [],
        priceMinor: 12_550,
        currency: 'TND' as const,
        ownerTrainerId: trainer._id,
        status: 'PUBLISHED' as const,
      };
      const [selfPaced, inPerson] = await TrainingModel.create([
        {
          ...common,
          title: 'TypeScript payé',
          type: 'SELF_PACED_ONLINE',
        },
        {
          ...common,
          title: 'Atelier payé',
          type: 'IN_PERSON',
          minimumAttendancePercent: 80,
        },
      ]);
      if (selfPaced === undefined || inPerson === undefined) {
        throw new Error('Phase 5 Trainings were not created.');
      }
      const module = await TrainingModuleModel.create({
        trainingId: selfPaced._id,
        title: 'Module protégé',
        description: '',
        order: 1,
        isArchived: false,
      });
      await LessonModel.create({
        trainingId: selfPaced._id,
        moduleId: module._id,
        title: 'Leçon payée',
        description: '',
        textContent: 'Accès après webhook uniquement.',
        instructions: '',
        order: 1,
        isArchived: false,
      });
      const session = await TrainingSessionModel.create({
        trainingId: inPerson._id,
        title: 'Dernière place',
        capacity: 1,
        enrolledCount: 0,
        assignedTrainerIds: [trainer._id],
        location: 'Centre Tunis',
        address: '',
        additionalInformation: '',
        status: 'PLANNED',
      });
      const config = loadAppConfig({
        ...validEnvironment(),
        MONGODB_URI: requiredUri(),
        UPLOAD_DIR: uploadRoot,
        CENTER_NAME: 'Centre Snapshot',
        CENTER_ADDRESS: '10 avenue de Tunis',
        CENTER_EMAIL: 'facturation@example.com',
        CENTER_REGISTRATION_ID: 'MF-12345',
      });
      const app = createApp({
        config,
        logger: pino({ level: 'silent' }),
        databaseReady: () => true,
        passwordResetMailService: mailService,
        stripeCheckoutGateway: new TestStripeGateway(config.stripe),
      });
      async function login(email: string): Promise<string> {
        const result = await request(app).post('/api/auth/login').send({
          email,
          password: 'Phase5-password-123!',
          client: 'MOBILE',
        });
        expect(result.status).toBe(200);
        return String(result.body.accessToken);
      }
      return {
        app,
        users: { admin, trainer, learner, secondLearner, thirdLearner },
        trainings: { selfPaced, inPerson },
        session,
        tokens: {
          admin: await login(admin.email),
          trainer: await login(trainer.email),
          learner: await login(learner.email),
          second: await login(secondLearner.email),
          third: await login(thirdLearner.email),
        },
      };
    }

    function signedEvent(
      payment: HydratedDocument<Payment> | null,
      eventId: string,
      type:
        | 'checkout.session.completed'
        | 'checkout.session.async_payment_failed'
        | 'checkout.session.expired' = 'checkout.session.completed',
    ) {
      if (payment === null || payment.stripeCheckoutSessionId === undefined) {
        throw new Error('Payment Checkout reference is missing.');
      }
      const payload = JSON.stringify({
        id: eventId,
        object: 'event',
        created: Math.floor(Date.now() / 1000),
        type,
        data: {
          object: {
            id: payment.stripeCheckoutSessionId,
            object: 'checkout.session',
            payment_status:
              type === 'checkout.session.completed' ? 'paid' : 'unpaid',
            amount_total: payment.amountMinor,
            currency: 'tnd',
            payment_intent: 'pi_test_phase5',
            metadata: {
              paymentId: String(payment._id),
              learnerId: String(payment.learnerId),
              trainingId: String(payment.trainingId),
              ...(payment.sessionId === undefined
                ? {}
                : { sessionId: String(payment.sessionId) }),
            },
          },
        },
      });
      return {
        payload,
        signature: Stripe.webhooks.generateTestHeaderString({
          payload,
          secret: webhookSecret,
        }),
      };
    }

    async function checkout(
      app: ReturnType<typeof createApp>,
      token: string,
      trainingId: string,
      sessionId?: string,
    ) {
      return await request(app)
        .post('/api/payments/checkout')
        .set('authorization', `Bearer ${token}`)
        .send({
          trainingId,
          ...(sessionId === undefined ? {} : { sessionId }),
        });
    }

    async function deliver(
      app: ReturnType<typeof createApp>,
      fixture: ReturnType<typeof signedEvent>,
    ) {
      return await request(app)
        .post('/api/payments/webhook/stripe')
        .set('content-type', 'application/json')
        .set('stripe-signature', fixture.signature)
        .send(fixture.payload);
    }

    it('grants access only after a verified, idempotent webhook and creates an immutable protected Invoice', async () => {
      const { app, users, trainings, tokens } = await setup();
      expect(
        (await checkout(app, tokens.trainer, String(trainings.selfPaced._id)))
          .status,
      ).toBe(403);
      const creation = await request(app)
        .post('/api/payments/checkout')
        .set('authorization', `Bearer ${tokens.learner}`)
        .send({
          trainingId: String(trainings.selfPaced._id),
          amountMinor: 1,
        });
      expect(creation.status).toBe(422);

      const checkoutResult = await checkout(
        app,
        tokens.learner,
        String(trainings.selfPaced._id),
      );
      expect(checkoutResult.status).toBe(201);
      expect(checkoutResult.body.payment.status).toBe('PENDING');
      expect(checkoutResult.body.payment.amountMinor).toBe(12_550);
      expect(String(checkoutResult.body.checkoutUrl)).toMatch(
        /^https:\/\/checkout\.stripe\.test\//,
      );
      const payment = await PaymentModel.findById(
        String(checkoutResult.body.payment.id),
      ).exec();
      if (payment === null) throw new Error('Payment was not persisted.');

      expect(
        (
          await request(app)
            .get(`/api/trainings/${String(trainings.selfPaced._id)}/content`)
            .set('authorization', `Bearer ${tokens.learner}`)
        ).status,
      ).toBe(403);
      expect(await EnrollmentModel.countDocuments()).toBe(0);
      expect(await InvoiceModel.countDocuments()).toBe(0);

      expect(
        (
          await request(app)
            .post('/api/payments/webhook/stripe')
            .set('content-type', 'application/json')
            .set('stripe-signature', 'invalid')
            .send('{}')
        ).status,
      ).toBe(400);

      expect(
        (await deliver(app, signedEvent(payment, 'evt_phase5_paid_1'))).status,
      ).toBe(200);
      expect(
        (await deliver(app, signedEvent(payment, 'evt_phase5_paid_repeat')))
          .status,
      ).toBe(200);
      expect(await EnrollmentModel.countDocuments()).toBe(1);
      expect(await InvoiceModel.countDocuments()).toBe(1);
      expect(await InvoiceItemModel.countDocuments()).toBe(1);
      expect(
        (
          await request(app)
            .get(`/api/trainings/${String(trainings.selfPaced._id)}/content`)
            .set('authorization', `Bearer ${tokens.learner}`)
        ).status,
      ).toBe(200);
      expect(
        (await checkout(app, tokens.learner, String(trainings.selfPaced._id)))
          .status,
      ).toBe(409);

      const invoice = await InvoiceModel.findOne({
        paymentId: payment._id,
      }).exec();
      if (invoice === null) throw new Error('Invoice was not created.');
      await UserModel.updateOne(
        { _id: users.learner._id },
        { $set: { 'profile.firstName': 'Changed' } },
      );
      await TrainingModel.updateOne(
        { _id: trainings.selfPaced._id },
        { $set: { title: 'Titre modifié', priceMinor: 99_999 } },
      );
      const detail = await request(app)
        .get(`/api/invoices/${String(invoice._id)}`)
        .set('authorization', `Bearer ${tokens.learner}`);
      expect(detail.status).toBe(200);
      expect(detail.body.learner.firstName).toBe('Ali');
      expect(detail.body.purchaseDescription).toBe('TypeScript payé');
      expect(detail.body.totalMinor).toBe(12_550);
      expect(detail.body.issuer.name).toBe('Centre Snapshot');

      expect(
        (
          await request(app)
            .get(`/api/invoices/${String(invoice._id)}/pdf`)
            .set('authorization', `Bearer ${tokens.second}`)
        ).status,
      ).toBe(404);
      const pdf = await request(app)
        .get(`/api/invoices/${String(invoice._id)}/pdf`)
        .set('authorization', `Bearer ${tokens.learner}`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');
      expect(Buffer.isBuffer(pdf.body)).toBe(true);
      const parser = new PDFParse({ data: pdf.body as Buffer });
      const parsed = await parser.getText();
      await parser.destroy();
      expect(parsed.text).toContain(invoice.number);
      expect(parsed.text).toContain('Ali Learner');
      expect(parsed.text).toContain('TypeScript payé');
      expect(parsed.text).toContain('125.50 TND');
      expect(parsed.text).toContain('Centre Snapshot');
      expect(
        (
          await request(app)
            .get('/api/payments')
            .set('authorization', `Bearer ${tokens.trainer}`)
        ).status,
      ).toBe(403);
    });

    it('allows only one fulfillment to consume the final Session seat and records expiry without Enrollment', async () => {
      const { app, trainings, session, tokens } = await setup();
      const first = await checkout(
        app,
        tokens.second,
        String(trainings.inPerson._id),
        String(session._id),
      );
      const second = await checkout(
        app,
        tokens.third,
        String(trainings.inPerson._id),
        String(session._id),
      );
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      const firstPayment = await PaymentModel.findById(
        first.body.payment.id,
      ).exec();
      const secondPayment = await PaymentModel.findById(
        second.body.payment.id,
      ).exec();
      if (firstPayment === null || secondPayment === null) {
        throw new Error('Capacity Payments were not created.');
      }
      expect(
        (await deliver(app, signedEvent(firstPayment, 'evt_capacity_first')))
          .status,
      ).toBe(200);
      expect(
        (await deliver(app, signedEvent(secondPayment, 'evt_capacity_second')))
          .status,
      ).toBe(200);
      expect(
        (await TrainingSessionModel.findById(session._id).exec())
          ?.enrolledCount,
      ).toBe(1);
      expect(
        await EnrollmentModel.countDocuments({ sessionId: session._id }),
      ).toBe(1);
      expect(
        (await PaymentModel.findById(firstPayment._id).exec())?.status,
      ).toBe('PAID');
      const failed = await PaymentModel.findById(secondPayment._id).exec();
      expect(failed?.status).toBe('FAILED');
      expect(failed?.failureCode).toBe('SESSION_CAPACITY_REACHED');
      expect(
        await InvoiceModel.countDocuments({ paymentId: secondPayment._id }),
      ).toBe(0);

      const pending = await PaymentModel.create({
        learnerId: firstPayment.learnerId,
        trainingId: trainings.inPerson._id,
        sessionId: new mongoose.Types.ObjectId(),
        purchaseType: 'IN_PERSON',
        status: 'PENDING',
        amountMinor: 12_550,
        currency: 'TND',
        trainingTitle: 'Atelier payé',
        sessionTitle: 'Session expirée',
        stripeCheckoutSessionId: `cs_test_${new mongoose.Types.ObjectId()}`,
      });
      expect(
        (
          await deliver(
            app,
            signedEvent(pending, 'evt_expired', 'checkout.session.expired'),
          )
        ).status,
      ).toBe(200);
      expect((await PaymentModel.findById(pending._id).exec())?.status).toBe(
        'CANCELLED',
      );
      expect(
        await EnrollmentModel.countDocuments({ paymentId: pending._id }),
      ).toBe(0);
    });
  },
);

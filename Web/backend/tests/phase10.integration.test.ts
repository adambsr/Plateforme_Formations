import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import mongoose from 'mongoose';
import { PDFParse } from 'pdf-parse';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import type { PasswordResetMailService } from '../src/infrastructure/mail/password-reset-mail.js';
import { AttendanceModel } from '../src/modules/attendance/models/attendance.model.js';
import { CertificateModel } from '../src/modules/certificates/models/certificate.model.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
import { EvaluationAttemptModel } from '../src/modules/evaluations/models/evaluation-attempt.model.js';
import { EvaluationModel } from '../src/modules/evaluations/models/evaluation.model.js';
import { FeedbackModel } from '../src/modules/feedback/models/feedback.model.js';
import { PaymentModel } from '../src/modules/payments/models/payment.model.js';
import { LessonProgressModel } from '../src/modules/progress/models/lesson-progress.model.js';
import { SessionScheduleModel } from '../src/modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../src/modules/sessions/models/training-session.model.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import { hashPassword } from '../src/shared/auth/password.js';
import { validEnvironment } from './fixtures/environment.js';

const databaseUri = process.env.TEST_MONGODB_URI;
const suite = databaseUri === undefined ? describe.skip : describe;
function requiredUri() {
  if (
    databaseUri === undefined ||
    new URL(databaseUri).pathname.slice(1) !==
      'plateforme_formations_integration'
  ) {
    throw new Error(
      'TEST_MONGODB_URI must use plateforme_formations_integration.',
    );
  }
  return databaseUri;
}

suite('Phase 10 Certificates and Feedback integration', () => {
  const mail: PasswordResetMailService = { async sendPasswordReset() {} };
  let uploadRoot = '';

  async function clean() {
    await Promise.all([
      CertificateModel.deleteMany({}),
      FeedbackModel.deleteMany({}),
      EvaluationAttemptModel.deleteMany({}),
      EvaluationModel.deleteMany({}),
      AttendanceModel.deleteMany({}),
      LessonProgressModel.deleteMany({}),
      EnrollmentModel.deleteMany({}),
      PaymentModel.deleteMany({}),
      SessionScheduleModel.deleteMany({}),
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
    uploadRoot = await mkdtemp(path.join(tmpdir(), 'phase10-documents-'));
    await mongoose.connect(requiredUri());
    await clean();
    await initializeDatabaseIndexes();
  });
  beforeEach(clean);
  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await clean();
      await mongoose.disconnect();
    }
    await rm(uploadRoot, { recursive: true, force: true });
  });

  async function setup() {
    const password = 'Phase10-password-123!';
    const passwordHash = await hashPassword(password);
    const [admin, owner, assigned, learner, outsider] = await UserModel.create([
      {
        email: 'admin.p10@example.com',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: 'Admin', lastName: 'Centre' },
        passwordChangedAt: new Date(),
      },
      {
        email: 'owner.p10@example.com',
        passwordHash,
        role: 'TRAINER',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: 'Owner', lastName: 'Trainer' },
        passwordChangedAt: new Date(),
      },
      {
        email: 'assigned.p10@example.com',
        passwordHash,
        role: 'TRAINER',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: 'Assigned', lastName: 'Trainer' },
        passwordChangedAt: new Date(),
      },
      {
        email: 'learner.p10@example.com',
        passwordHash,
        role: 'LEARNER',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: 'Leila', lastName: 'Ben Salah' },
        passwordChangedAt: new Date(),
      },
      {
        email: 'outsider.p10@example.com',
        passwordHash,
        role: 'LEARNER',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: 'Outside', lastName: 'Learner' },
        passwordChangedAt: new Date(),
      },
    ]);
    if (!admin || !owner || !assigned || !learner || !outsider) {
      throw new Error('Phase 10 users were not created.');
    }
    const category = await TrainingCategoryModel.create({
      name: 'Certification',
      normalizedName: 'certification',
      description: '',
      isArchived: false,
    });
    const training = await TrainingModel.create({
      title: 'TypeScript certifié',
      description: 'Formation Phase 10',
      categoryId: category._id,
      level: 'Avancé',
      durationMinutes: 180,
      objectives: [],
      prerequisites: [],
      type: 'SELF_PACED_ONLINE',
      priceMinor: 12_000,
      currency: 'EUR',
      ownerTrainerId: owner._id,
      status: 'PUBLISHED',
    });
    const module = await TrainingModuleModel.create({
      trainingId: training._id,
      title: 'Module',
      description: '',
      order: 1,
      isArchived: false,
    });
    const lesson = await LessonModel.create({
      trainingId: training._id,
      moduleId: module._id,
      title: 'Lesson',
      description: '',
      textContent: 'Contenu',
      instructions: '',
      order: 1,
      isArchived: false,
    });
    const payment = await PaymentModel.create({
      learnerId: learner._id,
      trainingId: training._id,
      purchaseType: 'SELF_PACED_ONLINE',
      status: 'PAID',
      amountMinor: 12_000,
      currency: 'EUR',
      trainingTitle: training.title,
      stripeCheckoutSessionId: `cs_p10_${new mongoose.Types.ObjectId()}`,
      stripePaymentIntentId: `pi_p10_${new mongoose.Types.ObjectId()}`,
      paidAt: new Date(),
    });
    const enrollment = await EnrollmentModel.create({
      learnerId: learner._id,
      trainingId: training._id,
      sessionId: null,
      paymentId: payment._id,
    });
    const config = loadAppConfig({
      ...validEnvironment(),
      MONGODB_URI: requiredUri(),
      UPLOAD_DIR: uploadRoot,
      CENTER_NAME: 'Centre Snapshot',
      CENTER_ADDRESS: '10 Avenue de Tunis',
      CENTER_EMAIL: 'centre.snapshot@example.com',
    });
    const app = createApp({
      config,
      logger: pino({ level: 'silent' }),
      databaseReady: () => true,
      passwordResetMailService: mail,
    });
    async function login(email: string) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password, client: 'MOBILE' });
      return String(response.body.accessToken);
    }
    return {
      app,
      users: { admin, owner, assigned, learner, outsider },
      category,
      training,
      lesson,
      enrollment,
      tokens: {
        admin: await login(admin.email),
        owner: await login(owner.email),
        assigned: await login(assigned.email),
        learner: await login(learner.email),
        outsider: await login(outsider.email),
      },
    };
  }

  async function completeSelfPaced(
    learnerId: mongoose.Types.ObjectId,
    trainingId: mongoose.Types.ObjectId,
    enrollmentId: mongoose.Types.ObjectId,
    lessonId: mongoose.Types.ObjectId,
  ) {
    await LessonProgressModel.create({
      enrollmentId,
      learnerId,
      trainingId,
      lessonId,
      completed: true,
      completedAt: new Date(),
    });
  }

  it('recalculates eligibility, issues one immutable snapshot/PDF, locks progress, and accepts one rating', async () => {
    const { app, users, training, lesson, enrollment, tokens } = await setup();
    const body = { enrollmentId: String(enrollment._id) };
    expect(
      (
        await request(app)
          .post('/api/certificates/generate')
          .set('authorization', `Bearer ${tokens.learner}`)
          .send(body)
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post('/api/feedback')
          .set('authorization', `Bearer ${tokens.learner}`)
          .send({ ...body, rating: 5 })
      ).status,
    ).toBe(409);
    await completeSelfPaced(
      users.learner._id,
      training._id,
      enrollment._id,
      lesson._id,
    );

    const first = await request(app)
      .post('/api/certificates/generate')
      .set('authorization', `Bearer ${tokens.learner}`)
      .send(body);
    expect(first.status).toBe(200);
    expect(first.body.number).toMatch(/^CERT-\d{4}-[A-F\d]{16}$/);
    expect(first.body.issuer.name).toBe('Centre Snapshot');
    expect(first.body.issuer.logoPath).toBeUndefined();
    const repeated = await request(app)
      .post('/api/certificates/generate')
      .set('authorization', `Bearer ${tokens.admin}`)
      .send(body);
    expect(repeated.body.id).toBe(first.body.id);
    expect(repeated.body.number).toBe(first.body.number);
    expect(await CertificateModel.countDocuments()).toBe(1);

    await UserModel.updateOne(
      { _id: users.learner._id },
      { $set: { 'profile.firstName': 'Changed' } },
    );
    await TrainingModel.updateOne(
      { _id: training._id },
      { $set: { title: 'Changed Training' } },
    );
    const detail = await request(app)
      .get(`/api/certificates/${String(first.body.id)}`)
      .set('authorization', `Bearer ${tokens.learner}`);
    expect(detail.body.learner.firstName).toBe('Leila');
    expect(detail.body.training.title).toBe('TypeScript certifié');

    const pdf = await request(app)
      .get(`/api/certificates/${String(first.body.id)}/pdf`)
      .set('authorization', `Bearer ${tokens.learner}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    const parser = new PDFParse({ data: pdf.body as Buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    expect(parsed.text).toContain(first.body.number);
    expect(parsed.text).toContain('Leila Ben Salah');
    expect(parsed.text).toContain('TypeScript certifié');
    expect(parsed.text).toContain('High Skills Academy');
    expect(parsed.text).toContain('HS');
    expect(
      (
        await request(app)
          .get(`/api/certificates/${String(first.body.id)}/pdf`)
          .set('authorization', `Bearer ${tokens.outsider}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .put(`/api/progress/lessons/${String(lesson._id)}`)
          .set('authorization', `Bearer ${tokens.learner}`)
          .send({ completed: false })
      ).status,
    ).toBe(409);

    expect(
      (
        await request(app)
          .post('/api/feedback')
          .set('authorization', `Bearer ${tokens.learner}`)
          .send({ ...body, rating: 5 })
      ).status,
    ).toBe(201);
    expect(
      (
        await request(app)
          .post('/api/feedback')
          .set('authorization', `Bearer ${tokens.learner}`)
          .send({ ...body, rating: 1 })
      ).status,
    ).toBe(409);
    const statistics = await request(app)
      .get('/api/feedback')
      .set('authorization', `Bearer ${tokens.admin}`);
    expect(statistics.body.global).toEqual({
      count: 1,
      average: 5,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
    });
    expect(statistics.body.byTraining[0].training.title).toBe(
      'Changed Training',
    );
    expect(
      (
        await request(app)
          .get('/api/feedback')
          .set('authorization', `Bearer ${tokens.learner}`)
      ).status,
    ).toBe(403);
  });

  it('requires a passed certifying Evaluation even for Admin generation and permits the owner after passing', async () => {
    const { app, users, training, lesson, enrollment, tokens } = await setup();
    await completeSelfPaced(
      users.learner._id,
      training._id,
      enrollment._id,
      lesson._id,
    );
    const evaluation = await EvaluationModel.create({
      trainingId: training._id,
      ownerTrainerId: users.owner._id,
      title: 'Évaluation certifiante',
      instructions: '',
      status: 'PUBLISHED',
      passPercentage: 70,
      maxAttempts: 3,
      publishedAt: new Date(),
    });
    await TrainingModel.updateOne(
      { _id: training._id },
      { $set: { certifyingEvaluationId: evaluation._id } },
    );
    const body = { enrollmentId: String(enrollment._id) };
    expect(
      (
        await request(app)
          .post('/api/certificates/generate')
          .set('authorization', `Bearer ${tokens.admin}`)
          .send(body)
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post('/api/feedback')
          .set('authorization', `Bearer ${tokens.learner}`)
          .send({ ...body, rating: 4 })
      ).status,
    ).toBe(409);
    const submittedAt = new Date();
    const attempt = await EvaluationAttemptModel.create({
      evaluationId: evaluation._id,
      trainingId: training._id,
      enrollmentId: enrollment._id,
      learnerId: users.learner._id,
      attemptNumber: 1,
      status: 'PASSED',
      startedAt: new Date(submittedAt.getTime() - 1_000),
      submittedAt,
      scorePoints: 1,
      totalPoints: 1,
      scorePercentage: 100,
      settings: { passPercentage: 70, maxAttempts: 3 },
    });
    const issued = await request(app)
      .post('/api/certificates/generate')
      .set('authorization', `Bearer ${tokens.owner}`)
      .send(body);
    expect(issued.status).toBe(200);
    expect(issued.body.eligibility.certifyingEvaluationId).toBe(
      String(evaluation._id),
    );
    expect(issued.body.eligibility.passedAttemptId).toBe(String(attempt._id));
    expect(
      (
        await request(app)
          .post('/api/certificates/generate')
          .set('authorization', `Bearer ${tokens.assigned}`)
          .send(body)
      ).status,
    ).toBe(404);
  });

  it('uses completed Session attendance eligibility and assigned-Trainer authorization', async () => {
    const {
      app,
      users,
      category,
      enrollment: selfEnrollment,
      tokens,
    } = await setup();
    const training = await TrainingModel.create({
      title: 'Présentiel certifié',
      description: 'Session Phase 10',
      categoryId: category._id,
      level: 'Débutant',
      durationMinutes: 240,
      objectives: [],
      prerequisites: [],
      type: 'IN_PERSON',
      priceMinor: 15_000,
      currency: 'EUR',
      ownerTrainerId: users.owner._id,
      status: 'PUBLISHED',
      minimumAttendancePercent: 80,
    });
    const session = await TrainingSessionModel.create({
      trainingId: training._id,
      title: 'Session août',
      capacity: 10,
      enrolledCount: 1,
      assignedTrainerIds: [users.assigned._id],
      location: 'Tunis',
      address: '',
      additionalInformation: '',
      status: 'COMPLETED',
    });
    const schedules = await SessionScheduleModel.create([
      {
        sessionId: session._id,
        trainingId: training._id,
        startAt: new Date('2026-08-01T08:00:00.000Z'),
        endAt: new Date('2026-08-01T10:00:00.000Z'),
        trainerIds: [users.assigned._id],
      },
      {
        sessionId: session._id,
        trainingId: training._id,
        startAt: new Date('2026-08-02T08:00:00.000Z'),
        endAt: new Date('2026-08-02T10:00:00.000Z'),
        trainerIds: [users.assigned._id],
      },
    ]);
    const payment = await PaymentModel.create({
      learnerId: users.learner._id,
      trainingId: training._id,
      sessionId: session._id,
      purchaseType: 'IN_PERSON',
      status: 'PAID',
      amountMinor: 15_000,
      currency: 'EUR',
      trainingTitle: training.title,
      sessionTitle: session.title,
      stripeCheckoutSessionId: `cs_p10_${new mongoose.Types.ObjectId()}`,
      stripePaymentIntentId: `pi_p10_${new mongoose.Types.ObjectId()}`,
      paidAt: new Date(),
    });
    const enrollment = await EnrollmentModel.create({
      learnerId: users.learner._id,
      trainingId: training._id,
      sessionId: session._id,
      paymentId: payment._id,
    });
    await AttendanceModel.insertMany(
      schedules.map((schedule) => ({
        enrollmentId: enrollment._id,
        learnerId: users.learner._id,
        trainingId: training._id,
        sessionId: session._id,
        scheduleId: schedule._id,
        status: 'PRESENT' as const,
        recordedById: users.assigned._id,
      })),
    );
    const issued = await request(app)
      .post('/api/certificates/generate')
      .set('authorization', `Bearer ${tokens.assigned}`)
      .send({ enrollmentId: String(enrollment._id) });
    expect(issued.status).toBe(200);
    expect(issued.body.sessionId).toBe(String(session._id));
    expect(issued.body.training.startsAt).toBe('2026-08-01T08:00:00.000Z');
    expect(issued.body.training.endsAt).toBe('2026-08-02T10:00:00.000Z');
    const list = await request(app)
      .get('/api/certificates?pageSize=100')
      .set('authorization', `Bearer ${tokens.assigned}`);
    expect(
      list.body.items.map(
        ({ enrollmentId }: { enrollmentId: string }) => enrollmentId,
      ),
    ).toEqual([String(enrollment._id)]);
    expect(String(selfEnrollment._id)).not.toBe(String(enrollment._id));
  });
});

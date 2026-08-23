import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import type { PasswordResetMailService } from '../src/infrastructure/mail/password-reset-mail.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { TrainingResourceModel } from '../src/modules/content/models/training-resource.model.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
import { EvaluationAnswerModel } from '../src/modules/evaluations/models/evaluation-answer.model.js';
import { EvaluationAttemptModel } from '../src/modules/evaluations/models/evaluation-attempt.model.js';
import { EvaluationModel } from '../src/modules/evaluations/models/evaluation.model.js';
import { EvaluationQuestionModel } from '../src/modules/evaluations/models/evaluation-question.model.js';
import type { QuestionGenerationGateway } from '../src/modules/evaluations/infrastructure/gemini-question-generation.gateway.js';
import { PaymentModel } from '../src/modules/payments/models/payment.model.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import { hashPassword } from '../src/shared/auth/password.js';
import { validEnvironment } from './fixtures/environment.js';

const uri = process.env.TEST_MONGODB_URI;
const suite = uri === undefined ? describe.skip : describe;
function requiredUri() {
  if (
    uri === undefined ||
    new URL(uri).pathname.slice(1) !== 'plateforme_formations_integration'
  )
    throw new Error(
      'TEST_MONGODB_URI must use plateforme_formations_integration.',
    );
  return uri;
}
class FakeAi implements QuestionGenerationGateway {
  readonly provider = 'TEST_GEMINI';
  readonly model = 'gemini-test';
  prompts: string[] = [];
  output: unknown = { questions: [] };
  async generate(input: { prompt: string }) {
    this.prompts.push(input.prompt);
    return this.output;
  }
}

suite('Phase 8 Evaluations and Phase 9 AI generation', () => {
  const mail: PasswordResetMailService = { async sendPasswordReset() {} };
  async function clean() {
    await Promise.all([
      EvaluationAnswerModel.deleteMany({}),
      EvaluationAttemptModel.deleteMany({}),
      EvaluationQuestionModel.deleteMany({}),
      EvaluationModel.deleteMany({}),
      EnrollmentModel.deleteMany({}),
      PaymentModel.deleteMany({}),
      TrainingResourceModel.deleteMany({}),
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
  });

  async function setup() {
    const password = 'Phase89-password-123!';
    const passwordHash = await hashPassword(password);
    const values = [
      ['admin.p89@example.com', 'ADMIN'],
      ['owner.p89@example.com', 'TRAINER'],
      ['other.p89@example.com', 'TRAINER'],
      ['learner.p89@example.com', 'LEARNER'],
      ['outsider.p89@example.com', 'LEARNER'],
    ] as const;
    const users = await UserModel.create(
      values.map(([email, role]) => ({
        email,
        passwordHash,
        role,
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: role },
        passwordChangedAt: new Date(),
      })),
    );
    const [admin, owner, other, learner, outsider] = users;
    if (!admin || !owner || !other || !learner || !outsider)
      throw new Error('Users missing.');
    const category = await TrainingCategoryModel.create({
      name: 'Evaluations',
      normalizedName: 'evaluations',
      description: '',
      isArchived: false,
    });
    const training = await TrainingModel.create({
      title: 'TypeScript strict',
      description: 'Selected Training',
      categoryId: category._id,
      level: 'Advanced',
      durationMinutes: 120,
      objectives: [],
      prerequisites: [],
      type: 'SELF_PACED_ONLINE',
      priceMinor: 1000,
      currency: 'EUR',
      ownerTrainerId: owner._id,
      status: 'PUBLISHED',
    });
    const hiddenTraining = await TrainingModel.create({
      title: 'Other',
      description: 'DO_NOT_SEND_OTHER_TRAINING',
      categoryId: category._id,
      level: 'Basic',
      durationMinutes: 60,
      objectives: [],
      prerequisites: [],
      type: 'SELF_PACED_ONLINE',
      priceMinor: 1000,
      currency: 'EUR',
      ownerTrainerId: owner._id,
      status: 'PUBLISHED',
    });
    const module = await TrainingModuleModel.create({
      trainingId: training._id,
      title: 'Types',
      description: '',
      order: 1,
      isArchived: false,
    });
    const lesson = await LessonModel.create({
      trainingId: training._id,
      moduleId: module._id,
      title: 'Narrowing',
      description: '',
      textContent: 'A discriminated union narrows through its literal tag.',
      instructions: '',
      order: 1,
      isArchived: false,
    });
    await TrainingResourceModel.create({
      trainingId: training._id,
      lessonId: lesson._id,
      title: 'Unsupported image',
      description: '',
      order: 1,
      type: 'FILE',
      isVisibleToLearners: true,
      file: {
        originalName: 'diagram.png',
        storageName: 'diagram.png',
        relativePath: 'training-resources/xx/diagram.png',
        mimeType: 'image/png',
        sizeBytes: 1,
        checksumSha256: 'a'.repeat(64),
        uploadedById: owner._id,
        uploadedAt: new Date(),
      },
      isArchived: false,
    });
    const payment = await PaymentModel.create({
      learnerId: learner._id,
      trainingId: training._id,
      purchaseType: 'SELF_PACED_ONLINE',
      status: 'PAID',
      amountMinor: 1000,
      currency: 'EUR',
      trainingTitle: training.title,
      stripeCheckoutSessionId: `cs_test_${new mongoose.Types.ObjectId()}`,
      stripePaymentIntentId: `pi_test_${new mongoose.Types.ObjectId()}`,
      paidAt: new Date(),
    });
    const enrollment = await EnrollmentModel.create({
      learnerId: learner._id,
      trainingId: training._id,
      sessionId: null,
      paymentId: payment._id,
    });
    const gateway = new FakeAi();
    const config = loadAppConfig({
      ...validEnvironment(),
      MONGODB_URI: requiredUri(),
    });
    const app = createApp({
      config,
      logger: pino({ level: 'silent' }),
      databaseReady: () => true,
      passwordResetMailService: mail,
      questionGenerationGateway: gateway,
    });
    async function login(email: string) {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password, client: 'MOBILE' });
      return String(response.body.accessToken);
    }
    return {
      app,
      gateway,
      users: { admin, owner, other, learner, outsider },
      training,
      hiddenTraining,
      enrollment,
      tokens: {
        admin: await login(admin.email),
        owner: await login(owner.email),
        other: await login(other.email),
        learner: await login(learner.email),
        outsider: await login(outsider.email),
      },
    };
  }
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it('enforces owner lifecycle, certifying designation, exact grading, answer release, and results access', async () => {
    const { app, training, hiddenTraining, enrollment, tokens } = await setup();
    const payload = {
      trainingId: String(training._id),
      title: 'Evaluation finale',
      instructions: 'Choisissez les bonnes réponses.',
      passPercentage: 75,
      maxAttempts: 2,
    };
    expect(
      (
        await request(app)
          .post('/api/evaluations')
          .set(auth(tokens.admin))
          .send(payload)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(
            `/api/evaluations?view=ACCESSIBLE&trainingId=${String(hiddenTraining._id)}`,
          )
          .set(auth(tokens.learner))
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/evaluations')
          .set(auth(tokens.other))
          .send(payload)
      ).status,
    ).toBe(403);
    const created = await request(app)
      .post('/api/evaluations')
      .set(auth(tokens.owner))
      .send(payload);
    expect(created.status).toBe(201);
    const id = String(created.body.id);
    const multiple = await request(app)
      .post(`/api/evaluations/${id}/questions`)
      .set(auth(tokens.owner))
      .send({
        type: 'MULTIPLE_CHOICE',
        prompt: 'Select both literal types.',
        options: [
          { id: 'A', text: 'string' },
          { id: 'B', text: 'number' },
          { id: 'C', text: 'object' },
        ],
        correctOptionIds: ['A', 'B'],
        explanation: 'Both are literal primitive types.',
        points: 2,
        order: 1,
      });
    const boolean = await request(app)
      .post(`/api/evaluations/${id}/questions`)
      .set(auth(tokens.owner))
      .send({
        type: 'TRUE_FALSE',
        prompt: 'A tag can narrow a union.',
        options: [
          { id: 'TRUE', text: 'True' },
          { id: 'FALSE', text: 'False' },
        ],
        correctOptionIds: ['TRUE'],
        explanation: 'The literal tag is the discriminator.',
        points: 2,
        order: 2,
      });
    expect(multiple.status).toBe(201);
    expect(boolean.status).toBe(201);
    const published = await request(app)
      .post(`/api/evaluations/${id}/publish`)
      .set(auth(tokens.owner));
    expect(published.body.status).toBe('PUBLISHED');
    expect(
      (
        await request(app)
          .put(`/api/questions/${String(multiple.body.id)}`)
          .set(auth(tokens.owner))
          .send({ prompt: 'Changed' })
      ).status,
    ).toBe(409);
    const designated = await request(app)
      .put(`/api/trainings/${String(training._id)}/certifying-evaluation`)
      .set(auth(tokens.owner))
      .send({ evaluationId: id });
    expect(designated.body.certifyingEvaluationId).toBe(id);
    expect(
      (
        await request(app)
          .post(`/api/evaluations/${id}/archive`)
          .set(auth(tokens.admin))
      ).body.error.code,
    ).toBe('CERTIFYING_EVALUATION_CANNOT_BE_ARCHIVED');
    expect(
      (
        await request(app)
          .post(`/api/evaluations/${id}/attempts`)
          .set(auth(tokens.outsider))
          .send({ enrollmentId: String(enrollment._id) })
      ).status,
    ).toBe(403);

    async function start() {
      return request(app)
        .post(`/api/evaluations/${id}/attempts`)
        .set(auth(tokens.learner))
        .send({ enrollmentId: String(enrollment._id) });
    }
    const first = await start();
    expect(first.status).toBe(201);
    const firstId = String(first.body.id);
    await request(app)
      .put(`/api/attempts/${firstId}/answers`)
      .set(auth(tokens.learner))
      .send({ questionId: multiple.body.id, selectedOptionIds: ['A'] });
    await request(app)
      .put(`/api/attempts/${firstId}/answers`)
      .set(auth(tokens.learner))
      .send({ questionId: boolean.body.id, selectedOptionIds: ['TRUE'] });
    const failed = await request(app)
      .post(`/api/attempts/${firstId}/submit`)
      .set(auth(tokens.learner));
    expect(failed.body).toMatchObject({
      status: 'FAILED',
      scorePercentage: 50,
      answersRevealed: false,
    });
    expect(failed.body.answers[0].question.correctOptionIds).toBeUndefined();
    const second = await start();
    const secondId = String(second.body.id);
    await request(app)
      .put(`/api/attempts/${secondId}/answers`)
      .set(auth(tokens.learner))
      .send({ questionId: multiple.body.id, selectedOptionIds: ['B', 'A'] });
    await request(app)
      .put(`/api/attempts/${secondId}/answers`)
      .set(auth(tokens.learner))
      .send({ questionId: boolean.body.id, selectedOptionIds: ['TRUE'] });
    const passed = await request(app)
      .post(`/api/attempts/${secondId}/submit`)
      .set(auth(tokens.learner));
    expect(passed.body).toMatchObject({
      status: 'PASSED',
      scorePercentage: 100,
      answersRevealed: true,
    });
    expect(passed.body.answers[0].question.correctOptionIds).toEqual([
      'A',
      'B',
    ]);
    const retake = await start();
    expect(retake.status).toBe(409);
    expect(retake.body.error.code).toBe('EVALUATION_ALREADY_COMPLETED');
    expect(
      (
        await request(app)
          .get(`/api/evaluations/${id}/results`)
          .set(auth(tokens.other))
      ).status,
    ).toBe(403);
    const results = await request(app)
      .get(`/api/evaluations/${id}/results`)
      .set(auth(tokens.admin));
    expect(results.body).toMatchObject({ totalAttempts: 2, passedAttempts: 1 });
  });

  it('uses server timestamps to expire and consume an immutable attempt', async () => {
    const { app, training, enrollment, users, tokens } = await setup();
    const evaluation = await EvaluationModel.create({
      trainingId: training._id,
      ownerTrainerId: users.owner._id,
      title: 'Timed',
      instructions: '',
      status: 'PUBLISHED',
      passPercentage: 50,
      maxAttempts: 1,
      durationMinutes: 1,
      publishedAt: new Date(),
    });
    const question = await EvaluationQuestionModel.create({
      evaluationId: evaluation._id,
      trainingId: training._id,
      type: 'TRUE_FALSE',
      prompt: 'TypeScript is typed.',
      options: [
        { id: 'TRUE', text: 'True' },
        { id: 'FALSE', text: 'False' },
      ],
      correctOptionIds: ['TRUE'],
      points: 1,
      order: 1,
    });
    const started = await request(app)
      .post(`/api/evaluations/${String(evaluation._id)}/attempts`)
      .set(auth(tokens.learner))
      .send({ enrollmentId: String(enrollment._id) });
    await EvaluationAttemptModel.updateOne(
      { _id: started.body.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await request(app)
      .get(`/api/attempts/${String(started.body.id)}`)
      .set(auth(tokens.learner));
    expect(expired.body).toMatchObject({
      status: 'FAILED',
      scorePercentage: 0,
      answersRevealed: true,
    });
    expect(
      (
        await request(app)
          .put(`/api/attempts/${String(started.body.id)}/answers`)
          .set(auth(tokens.learner))
          .send({
            questionId: String(question._id),
            selectedOptionIds: ['TRUE'],
          })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/api/evaluations/${String(evaluation._id)}/attempts`)
          .set(auth(tokens.learner))
          .send({ enrollmentId: String(enrollment._id) })
      ).body.error.code,
    ).toBe('ATTEMPT_LIMIT_REACHED');
  });

  it('isolates Training context, validates AI output, imports drafts only, and reports skipped files/no-text', async () => {
    const { app, gateway, training, hiddenTraining, users, tokens } =
      await setup();
    const evaluation = await EvaluationModel.create({
      trainingId: training._id,
      ownerTrainerId: users.owner._id,
      title: 'AI draft',
      instructions: '',
      status: 'DRAFT',
      passPercentage: 70,
      maxAttempts: 3,
    });
    gateway.output = {
      questions: [
        {
          type: 'SINGLE_CHOICE',
          prompt: 'What narrows the union?',
          options: [
            { id: 'A', text: 'Literal tag' },
            { id: 'B', text: 'Random value' },
          ],
          correctOptionIds: ['A'],
          explanation: 'The tag discriminates.',
          points: 1,
        },
      ],
    };
    const generated = await request(app)
      .post(`/api/evaluations/${String(evaluation._id)}/generate-ai`)
      .set(auth(tokens.owner))
      .send({ questionCount: 1, questionTypes: ['SINGLE_CHOICE'] });
    expect(generated.status).toBe(201);
    expect(generated.body.evaluation).toMatchObject({
      status: 'DRAFT',
      questionCount: 1,
    });
    expect(generated.body.extraction.skippedResources[0]).toMatchObject({
      name: 'diagram.png',
      reason: 'UNSUPPORTED',
    });
    expect(gateway.prompts[0]).toContain('discriminated union');
    expect(gateway.prompts[0]).not.toContain('DO_NOT_SEND_OTHER_TRAINING');
    expect(gateway.prompts[0]).not.toContain(users.learner.email);

    gateway.output = {
      questions: [{ type: 'SINGLE_CHOICE', prompt: '', options: [] }],
    };
    const invalid = await request(app)
      .post(`/api/evaluations/${String(evaluation._id)}/generate-ai`)
      .set(auth(tokens.owner))
      .send({ questionCount: 1, questionTypes: ['SINGLE_CHOICE'] });
    expect(invalid.body.error.code).toBe('AI_RESPONSE_SCHEMA_INVALID');
    expect(
      await EvaluationQuestionModel.countDocuments({
        evaluationId: evaluation._id,
      }),
    ).toBe(1);

    const empty = await EvaluationModel.create({
      trainingId: hiddenTraining._id,
      ownerTrainerId: users.owner._id,
      title: 'Empty AI draft',
      instructions: '',
      status: 'DRAFT',
      passPercentage: 70,
      maxAttempts: 3,
    });
    const noText = await request(app)
      .post(`/api/evaluations/${String(empty._id)}/generate-ai`)
      .set(auth(tokens.owner))
      .send({ questionCount: 1, questionTypes: ['TRUE_FALSE'] });
    expect(noText.body.error.code).toBe('NO_EXTRACTABLE_TRAINING_TEXT');
    expect(gateway.prompts).toHaveLength(2);
  });
});

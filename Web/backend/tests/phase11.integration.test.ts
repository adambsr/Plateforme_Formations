import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import { AttendanceModel } from '../src/modules/attendance/models/attendance.model.js';
import { CostService } from '../src/modules/costs/services/cost.service.js';
import { TrainerCostModel } from '../src/modules/costs/models/trainer-cost.model.js';
import { TrainingCostModel } from '../src/modules/costs/models/training-cost.model.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { DashboardService } from '../src/modules/dashboard/services/dashboard.service.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
import { PaymentModel } from '../src/modules/payments/models/payment.model.js';
import { LessonProgressModel } from '../src/modules/progress/models/lesson-progress.model.js';
import { SessionScheduleModel } from '../src/modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../src/modules/sessions/models/training-session.model.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import type { AuthenticatedPrincipal } from '../src/shared/auth/principal.js';

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

suite('Phase 11 costs and dashboard integration', () => {
  const costs = new CostService();
  const dashboard = new DashboardService();
  const admin: AuthenticatedPrincipal = {
    userId: new mongoose.Types.ObjectId().toString(),
    role: 'ADMIN',
    mustChangePassword: false,
  };
  const learner: AuthenticatedPrincipal = { ...admin, role: 'LEARNER' };
  async function clean() {
    await Promise.all([
      TrainerCostModel.deleteMany({}),
      TrainingCostModel.deleteMany({}),
      AttendanceModel.deleteMany({}),
      LessonProgressModel.deleteMany({}),
      LessonModel.deleteMany({}),
      TrainingModuleModel.deleteMany({}),
      EnrollmentModel.deleteMany({}),
      SessionScheduleModel.deleteMany({}),
      PaymentModel.deleteMany({}),
      TrainingSessionModel.deleteMany({}),
      TrainingModel.deleteMany({}),
      TrainingCategoryModel.deleteMany({}),
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
    const [trainer, learnerUser] = await UserModel.create([
      {
        email: 'trainer.p11@example.com',
        passwordHash: 'unused',
        role: 'TRAINER',
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        profile: { firstName: 'Trainer' },
      },
      {
        email: 'learner.p11@example.com',
        passwordHash: 'unused',
        role: 'LEARNER',
        isActive: true,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        profile: { firstName: 'Learner' },
      },
    ]);
    if (!trainer || !learnerUser) throw new Error('Fixtures were not created.');
    const category = await TrainingCategoryModel.create({
      name: 'Phase 11',
      normalizedName: 'phase 11',
      isArchived: false,
    });
    const values = {
      description: 'Dashboard fixture',
      categoryId: category._id,
      level: 'Base',
      durationMinutes: 60,
      objectives: [],
      prerequisites: [],
      priceMinor: 10_000,
      currency: 'EUR' as const,
      ownerTrainerId: trainer._id,
      status: 'PUBLISHED' as const,
    };
    const training = await TrainingModel.create({
      ...values,
      title: 'Main',
      type: 'SELF_PACED_ONLINE',
    });
    const otherTraining = await TrainingModel.create({
      ...values,
      title: 'Other',
      type: 'IN_PERSON',
      minimumAttendancePercent: 80,
    });
    const otherSession = await TrainingSessionModel.create({
      trainingId: otherTraining._id,
      title: 'Other Session',
      capacity: 10,
      enrolledCount: 0,
      assignedTrainerIds: [trainer._id],
      location: 'Tunis',
      address: '',
      additionalInformation: '',
      status: 'PLANNED',
    });
    return { trainer, learnerUser, training, otherSession };
  }

  it('enforces Admin-only access, monthly upsert uniqueness, and Session ownership', async () => {
    const { trainer, training, otherSession } = await setup();
    await expect(
      costs.listTrainerCosts(learner, { page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ status: 403 });
    const path = { trainerId: String(trainer._id), year: 2026, month: 1 };
    await costs.upsertTrainerCost(admin, path, {
      amountMinor: 900_000,
      note: 'First',
    });
    const updated = await costs.upsertTrainerCost(admin, path, {
      amountMinor: 950_000,
    });
    expect(updated.amountMinor).toBe(950_000);
    expect(updated.note).toBeUndefined();
    expect(await TrainerCostModel.countDocuments()).toBe(1);
    await expect(
      costs.createTrainingCost(admin, {
        trainingId: String(training._id),
        sessionId: String(otherSession._id),
        date: '2026-01-10',
        amountMinor: 25_000,
        label: 'Room',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'TRAINING_SESSION_MISMATCH' });
  });

  it('uses paid revenue, inclusive Tunis dates, full months, explicit costs, and null at zero revenue', async () => {
    const { trainer, learnerUser, training } = await setup();
    await TrainerCostModel.create([
      {
        trainerId: trainer._id,
        year: 2026,
        month: 1,
        amountMinor: 300_000,
        currency: 'EUR',
      },
      {
        trainerId: trainer._id,
        year: 2026,
        month: 2,
        amountMinor: 400_000,
        currency: 'EUR',
      },
    ]);
    await PaymentModel.create([
      {
        learnerId: learnerUser._id,
        trainingId: training._id,
        purchaseType: 'SELF_PACED_ONLINE',
        status: 'PAID',
        amountMinor: 1_000_000,
        currency: 'EUR',
        trainingTitle: training.title,
        stripeCheckoutSessionId: 'cs_p11_paid',
        paidAt: new Date('2025-12-31T23:00:00.000Z'),
      },
      {
        learnerId: learnerUser._id,
        trainingId: training._id,
        purchaseType: 'SELF_PACED_ONLINE',
        status: 'FAILED',
        amountMinor: 9_000_000,
        currency: 'EUR',
        trainingTitle: training.title,
        stripeCheckoutSessionId: 'cs_p11_failed',
        paidAt: new Date('2026-01-10T12:00:00.000Z'),
      },
      {
        learnerId: learnerUser._id,
        trainingId: training._id,
        purchaseType: 'SELF_PACED_ONLINE',
        status: 'PAID',
        amountMinor: 2_000_000,
        currency: 'EUR',
        trainingTitle: training.title,
        stripeCheckoutSessionId: 'cs_p11_outside',
        paidAt: new Date('2026-02-15T23:00:00.000Z'),
      },
    ]);
    await costs.createTrainingCost(admin, {
      trainingId: String(training._id),
      date: '2026-01-31',
      amountMinor: 100_000,
      label: 'Materials',
    });
    const result = await dashboard.profitability(admin, {
      from: '2026-01-01',
      to: '2026-02-15',
    });
    expect(result).toMatchObject({
      revenueMinor: 1_000_000,
      trainerCostsMinor: 300_000,
      trainingCostsMinor: 100_000,
      resultMinor: 600_000,
      profitabilityPercent: 60,
    });
    expect(result.includedTrainerMonths).toEqual([{ year: 2026, month: 1 }]);
    expect(result.byTraining[0]).toMatchObject({
      revenueMinor: 1_000_000,
      trainingCostsMinor: 100_000,
      resultBeforeFixedTrainerCostsMinor: 900_000,
    });
    const empty = await dashboard.profitability(admin, {
      from: '2026-03-01',
      to: '2026-03-31',
    });
    expect(empty).toMatchObject({
      revenueMinor: 0,
      profitabilityPercent: null,
    });
  });

  it('calculates participation from scheduled attendance in the selected period', async () => {
    const { trainer, learnerUser, otherSession } = await setup();
    const schedule = await SessionScheduleModel.create({
      sessionId: otherSession._id,
      trainingId: otherSession.trainingId,
      startAt: new Date('2026-06-08T09:00:00.000Z'),
      endAt: new Date('2026-06-08T16:00:00.000Z'),
      trainerIds: [trainer._id],
    });
    const payment = await PaymentModel.create({
      learnerId: learnerUser._id,
      trainingId: otherSession.trainingId,
      sessionId: otherSession._id,
      purchaseType: 'IN_PERSON',
      status: 'PAID',
      amountMinor: 10_000,
      currency: 'EUR',
      trainingTitle: 'Other',
      sessionTitle: otherSession.title,
      stripeCheckoutSessionId: 'cs_p11_participation',
      paidAt: new Date('2026-05-01T09:00:00.000Z'),
    });
    const enrollment = await EnrollmentModel.create({
      learnerId: learnerUser._id,
      trainingId: otherSession.trainingId,
      sessionId: otherSession._id,
      paymentId: payment._id,
    });
    await AttendanceModel.create({
      enrollmentId: enrollment._id,
      learnerId: learnerUser._id,
      trainingId: otherSession.trainingId,
      sessionId: otherSession._id,
      scheduleId: schedule._id,
      status: 'PRESENT',
      recordedById: trainer._id,
    });

    const result = await dashboard.participation(admin, {
      from: '2026-01-01',
      to: '2026-08-23',
    });

    expect(result.overall).toEqual({
      expected: 1,
      recorded: 1,
      present: 1,
      participationPercent: 100,
    });
    expect(result.byTraining).toEqual([
      expect.objectContaining({
        expected: 1,
        recorded: 1,
        present: 1,
        participationPercent: 100,
      }),
    ]);
  });

  it('recommends published unenrolled Trainings from the Learner history first', async () => {
    const { trainer, learnerUser, training } = await setup();
    await EnrollmentModel.create({
      learnerId: learnerUser._id,
      trainingId: training._id,
      sessionId: null,
      paymentId: new mongoose.Types.ObjectId(),
    });
    const related = await TrainingModel.create({
      title: 'Related next step',
      description: 'Related recommendation',
      categoryId: training.categoryId,
      level: 'Advanced',
      durationMinutes: 120,
      objectives: [],
      prerequisites: [],
      type: 'SELF_PACED_ONLINE',
      priceMinor: 12_000,
      currency: 'EUR',
      ownerTrainerId: trainer._id,
      status: 'PUBLISHED',
    });
    await TrainingModel.create({
      title: 'Unrelated',
      description: 'Cold-start fallback',
      categoryId: (
        await TrainingCategoryModel.create({
          name: 'Other category',
          normalizedName: 'other category',
          isArchived: false,
        })
      )._id,
      level: 'Base',
      durationMinutes: 60,
      objectives: [],
      prerequisites: [],
      type: 'SELF_PACED_ONLINE',
      priceMinor: 8_000,
      currency: 'EUR',
      ownerTrainerId: trainer._id,
      status: 'PUBLISHED',
    });

    const result = await dashboard.recommendations({
      userId: String(learnerUser._id),
      role: 'LEARNER',
      mustChangePassword: false,
    });

    expect(result.recommendations[0]).toMatchObject({
      id: String(related._id),
      title: 'Related next step',
    });
    expect(result.recommendations.map((row) => row.id)).not.toContain(
      String(training._id),
    );
    await expect(dashboard.recommendations(admin)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('reports monthly self-paced completions and unfinished Learners inactive for 30 days', async () => {
    const { learnerUser, training } = await setup();
    const inactiveLearner = await UserModel.create({
      email: 'inactive.p11@example.com',
      passwordHash: 'unused',
      role: 'LEARNER',
      isActive: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      profile: { firstName: 'Inactive' },
    });
    const trainingModule = await TrainingModuleModel.create({
      trainingId: training._id,
      title: 'Module',
      description: '',
      order: 1,
      isArchived: false,
    });
    const lesson = await LessonModel.create({
      trainingId: training._id,
      moduleId: trainingModule._id,
      title: 'Lesson',
      description: '',
      textContent: '',
      instructions: '',
      order: 1,
      isArchived: false,
    });
    const [completedEnrollment, inactiveEnrollment] =
      await EnrollmentModel.create([
        {
          learnerId: learnerUser._id,
          trainingId: training._id,
          sessionId: null,
          paymentId: new mongoose.Types.ObjectId(),
        },
        {
          learnerId: inactiveLearner._id,
          trainingId: training._id,
          sessionId: null,
          paymentId: new mongoose.Types.ObjectId(),
        },
      ]);
    if (!completedEnrollment || !inactiveEnrollment) {
      throw new Error('Enrollment fixtures were not created.');
    }
    await EnrollmentModel.updateOne(
      { _id: inactiveEnrollment._id },
      { $set: { createdAt: new Date('2026-06-01T00:00:00.000Z') } },
    );
    await LessonProgressModel.create({
      enrollmentId: completedEnrollment._id,
      learnerId: learnerUser._id,
      trainingId: training._id,
      lessonId: lesson._id,
      completed: true,
      completedAt: new Date('2026-08-15T12:00:00.000Z'),
    });
    const intelligence = new DashboardService(
      () => new Date('2026-08-30T12:00:00.000Z'),
    );

    const result = await intelligence.learningInsights(admin, {
      from: '2026-08-01',
      to: '2026-08-31',
    });

    expect(result.completionTrend).toEqual([
      { month: '2026-08', completed: 1 },
    ]);
    expect(result.inactivity).toMatchObject({
      thresholdDays: 30,
      total: 1,
      learners: [
        expect.objectContaining({
          learner: expect.objectContaining({
            id: String(inactiveLearner._id),
          }),
          activeTrainingCount: 1,
        }),
      ],
    });
    await expect(
      intelligence.learningInsights(learner, {
        from: '2026-08-01',
        to: '2026-08-31',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

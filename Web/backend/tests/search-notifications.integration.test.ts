import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
import { NotificationModel } from '../src/modules/notifications/models/notification.model.js';
import { NotificationService } from '../src/modules/notifications/services/notification.service.js';
import { SearchService } from '../src/modules/search/services/search.service.js';
import { SessionScheduleModel } from '../src/modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../src/modules/sessions/models/training-session.model.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import type { AuthenticatedPrincipal } from '../src/shared/auth/principal.js';

const databaseUri = process.env.TEST_MONGODB_URI;
const suite = databaseUri === undefined ? describe.skip : describe;

function requiredUri(): string {
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

suite('Search and persistent notification integration', () => {
  const notifications = new NotificationService({
    enabled: false,
    googleApplicationCredentials: undefined,
  });
  const search = new SearchService();

  async function clean() {
    await Promise.all([
      NotificationModel.deleteMany({}),
      EnrollmentModel.deleteMany({}),
      SessionScheduleModel.deleteMany({}),
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

  async function fixtures() {
    const [admin, trainer, learner, otherLearner, outsiderTrainer] =
      await UserModel.create([
        {
          email: 'admin.search@example.com',
          passwordHash: 'unused',
          role: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          profile: { firstName: 'Admin' },
        },
        {
          email: 'trainer.search@example.com',
          passwordHash: 'unused',
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          profile: { firstName: 'Salma' },
        },
        {
          email: 'learner.search@example.com',
          passwordHash: 'unused',
          role: 'LEARNER',
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          profile: { firstName: 'Amina', lastName: 'Ben Ali' },
        },
        {
          email: 'private.search@example.com',
          passwordHash: 'unused',
          role: 'LEARNER',
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          profile: { firstName: 'Private' },
        },
        {
          email: 'outsider.search@example.com',
          passwordHash: 'unused',
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          profile: { firstName: 'Outside' },
        },
      ]);
    if (!admin || !trainer || !learner || !otherLearner || !outsiderTrainer)
      throw new Error('Fixtures missing.');
    const category = await TrainingCategoryModel.create({
      name: 'Data',
      normalizedName: 'data',
      isArchived: false,
    });
    const training = await TrainingModel.create({
      title: 'Power BI : tableaux de bord',
      description: 'Décision et visualisation',
      categoryId: category._id,
      level: 'Intermédiaire',
      durationMinutes: 600,
      objectives: [],
      prerequisites: [],
      type: 'IN_PERSON',
      priceMinor: 29_900,
      currency: 'EUR',
      ownerTrainerId: trainer._id,
      status: 'PUBLISHED',
      minimumAttendancePercent: 80,
    });
    const session = await TrainingSessionModel.create({
      trainingId: training._id,
      title: 'Power BI : Session de septembre',
      capacity: 12,
      enrolledCount: 1,
      assignedTrainerIds: [trainer._id],
      location: 'Tunis',
      address: '',
      additionalInformation: '',
      status: 'PLANNED',
    });
    const schedule = await SessionScheduleModel.create({
      sessionId: session._id,
      trainingId: training._id,
      startAt: new Date(Date.now() + 2 * 60 * 60 * 1_000),
      endAt: new Date(Date.now() + 4 * 60 * 60 * 1_000),
      trainerIds: [trainer._id],
    });
    await EnrollmentModel.create({
      learnerId: learner._id,
      trainingId: training._id,
      sessionId: session._id,
      paymentId: new mongoose.Types.ObjectId(),
    });
    const principal = (
      user: typeof learner,
      role: AuthenticatedPrincipal['role'],
    ): AuthenticatedPrincipal => ({
      userId: String(user._id),
      role,
      mustChangePassword: false,
    });
    return {
      admin,
      trainer,
      learner,
      otherLearner,
      outsiderTrainer,
      training,
      session,
      schedule,
      principal,
    };
  }

  it('deduplicates real events and never lets another user mutate ownership', async () => {
    const { learner, otherLearner, principal } = await fixtures();
    const streamed: string[] = [];
    const unsubscribe = notifications.subscribe(String(learner._id), (item) =>
      streamed.push(item.id),
    );
    const input = {
      recipientUserId: String(learner._id),
      type: 'PURCHASE_CONFIRMED',
      title: 'Formation achetée',
      message: 'Votre inscription est confirmée.',
      dedupeKey: 'payment-paid:p1',
      link: '/app/payments',
    };
    const [first] = await Promise.all(
      Array.from({ length: 5 }, () => notifications.createInApp(input)),
    );
    if (first === undefined) throw new Error('Notification was not created.');
    expect(
      await NotificationModel.countDocuments({
        recipientUserId: learner._id,
        dedupeKey: input.dedupeKey,
      }),
    ).toBe(1);
    expect(streamed).toEqual([first.id]);
    unsubscribe();
    await expect(
      notifications.markRead(principal(otherLearner, 'LEARNER'), first.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await notifications.markRead(principal(learner, 'LEARNER'), first.id))
        .read,
    ).toBe(true);
    expect(
      (await notifications.markAllRead(principal(learner, 'LEARNER'))).unread,
    ).toBe(0);
  });

  it('creates scoped upcoming reminders once and returns only the recipient feed', async () => {
    const { learner, otherLearner, principal, schedule } = await fixtures();
    const own = principal(learner, 'LEARNER');
    await notifications.unreadCount(own);
    await notifications.unreadCount(own);
    expect(
      await NotificationModel.countDocuments({
        recipientUserId: learner._id,
        dedupeKey: `schedule:${String(schedule._id)}:24h`,
      }),
    ).toBe(1);
    expect(
      (
        await notifications.list(principal(otherLearner, 'LEARNER'), {
          page: 1,
          pageSize: 20,
          state: 'ALL',
        })
      ).items,
    ).toHaveLength(0);
  });

  it('enforces learner, trainer, and Admin search visibility in server queries', async () => {
    const {
      admin,
      trainer,
      learner,
      otherLearner,
      outsiderTrainer,
      principal,
    } = await fixtures();
    const learnerResult = await search.search(principal(learner, 'LEARNER'), {
      q: 'Amina',
      limit: 5,
    });
    expect(
      learnerResult.groups.find(({ type }) => type === 'USER'),
    ).toBeUndefined();
    const trainerResult = await search.search(principal(trainer, 'TRAINER'), {
      q: 'Amina',
      limit: 5,
    });
    expect(
      trainerResult.groups.find(({ type }) => type === 'USER')?.items[0]?.id,
    ).toBe(String(learner._id));
    for (const query of [
      'Amina Ben Ali',
      'Amina Be',
      'learner.search@example.com',
      'learner.sea',
    ]) {
      const result = await search.search(principal(trainer, 'TRAINER'), {
        q: query,
        limit: 5,
      });
      expect(
        result.groups.find(({ type }) => type === 'USER')?.items[0]?.id,
      ).toBe(String(learner._id));
    }
    const outsiderResult = await search.search(
      principal(outsiderTrainer, 'TRAINER'),
      { q: 'Amina', limit: 5 },
    );
    expect(
      outsiderResult.groups.find(({ type }) => type === 'USER'),
    ).toBeUndefined();
    const adminResult = await search.search(principal(admin, 'ADMIN'), {
      q: 'Private',
      limit: 5,
    });
    expect(
      adminResult.groups.find(({ type }) => type === 'USER')?.items[0]?.id,
    ).toBe(String(otherLearner._id));
    for (const query of [
      'Amina Ben Ali',
      'Amina Be',
      'learner.search@example.com',
      'learner.sea',
    ]) {
      const result = await search.search(principal(admin, 'ADMIN'), {
        q: query,
        limit: 5,
      });
      expect(
        result.groups.find(({ type }) => type === 'USER')?.items[0]?.id,
      ).toBe(String(learner._id));
    }
  });
});

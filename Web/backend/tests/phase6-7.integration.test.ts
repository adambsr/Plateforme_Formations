import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import type { PasswordResetMailService } from '../src/infrastructure/mail/password-reset-mail.js';
import { AttendanceModel } from '../src/modules/attendance/models/attendance.model.js';
import { LessonModel } from '../src/modules/content/models/lesson.model.js';
import { TrainingModuleModel } from '../src/modules/content/models/training-module.model.js';
import { EnrollmentModel } from '../src/modules/enrollments/models/enrollment.model.js';
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

integrationDescribe(
  'Phase 6 progression and Phase 7 Attendance integration',
  () => {
    const mailService: PasswordResetMailService = {
      async sendPasswordReset() {},
    };

    async function clean() {
      await Promise.all([
        mongoose.connection.collection('certificates').deleteMany({}),
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
      const password = 'Phase67-password-123!';
      const passwordHash = await hashPassword(password);
      const [admin, owner, assigned, learner, secondLearner, outsider] =
        await UserModel.create([
          {
            email: 'admin.phase67@example.com',
            passwordHash,
            role: 'ADMIN',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Admin', lastName: 'Centre' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'owner.phase67@example.com',
            passwordHash,
            role: 'TRAINER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Owner', lastName: 'Trainer' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'assigned.phase67@example.com',
            passwordHash,
            role: 'TRAINER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Assigned', lastName: 'Trainer' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'learner.phase67@example.com',
            passwordHash,
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Leila', lastName: 'Learner' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'second.phase67@example.com',
            passwordHash,
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Sami', lastName: 'Second' },
            passwordChangedAt: new Date(),
          },
          {
            email: 'outsider.phase67@example.com',
            passwordHash,
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'No', lastName: 'Enrollment' },
            passwordChangedAt: new Date(),
          },
        ]);
      if (
        admin === undefined ||
        owner === undefined ||
        assigned === undefined ||
        learner === undefined ||
        secondLearner === undefined ||
        outsider === undefined
      ) {
        throw new Error('Phase 6/7 users were not created.');
      }
      const category = await TrainingCategoryModel.create({
        name: 'Progression et présence',
        normalizedName: 'progression et presence',
        description: '',
        isArchived: false,
      });
      const common = {
        description: 'Formation de test Phase 6 et 7.',
        categoryId: category._id,
        level: 'Intermédiaire',
        durationMinutes: 240,
        objectives: [],
        prerequisites: [],
        priceMinor: 10_000,
        currency: 'TND' as const,
        ownerTrainerId: owner._id,
        status: 'PUBLISHED' as const,
      };
      const [selfPaced, inPerson] = await TrainingModel.create([
        {
          ...common,
          title: 'Progression self-paced',
          type: 'SELF_PACED_ONLINE',
        },
        {
          ...common,
          title: 'Présence en salle',
          type: 'IN_PERSON',
          minimumAttendancePercent: 80,
        },
      ]);
      if (selfPaced === undefined || inPerson === undefined) {
        throw new Error('Phase 6/7 Trainings were not created.');
      }
      const module = await TrainingModuleModel.create({
        trainingId: selfPaced._id,
        title: 'Module actif',
        description: '',
        order: 1,
        isArchived: false,
      });
      const [lessonOne, lessonTwo] = await LessonModel.create([
        {
          trainingId: selfPaced._id,
          moduleId: module._id,
          title: 'Leçon une',
          description: '',
          textContent: '',
          instructions: '',
          order: 1,
          isArchived: false,
        },
        {
          trainingId: selfPaced._id,
          moduleId: module._id,
          title: 'Leçon deux',
          description: '',
          textContent: '',
          instructions: '',
          order: 2,
          isArchived: false,
        },
      ]);
      if (lessonOne === undefined || lessonTwo === undefined) {
        throw new Error('Phase 6 Lessons were not created.');
      }
      const session = await TrainingSessionModel.create({
        trainingId: inPerson._id,
        title: 'Session avec présences',
        capacity: 10,
        enrolledCount: 2,
        assignedTrainerIds: [assigned._id],
        location: 'Centre Tunis',
        address: '',
        additionalInformation: '',
        status: 'PLANNED',
      });
      const [scheduleOne, scheduleTwo] = await SessionScheduleModel.create([
        {
          sessionId: session._id,
          trainingId: inPerson._id,
          startAt: new Date('2026-08-22T08:00:00.000Z'),
          endAt: new Date('2026-08-22T10:00:00.000Z'),
          trainerIds: [assigned._id],
        },
        {
          sessionId: session._id,
          trainingId: inPerson._id,
          startAt: new Date('2026-08-23T08:00:00.000Z'),
          endAt: new Date('2026-08-23T10:00:00.000Z'),
          trainerIds: [assigned._id],
        },
      ]);
      if (scheduleOne === undefined || scheduleTwo === undefined) {
        throw new Error('Phase 7 schedules were not created.');
      }

      async function paidEnrollment(
        targetLearner: NonNullable<typeof learner>,
        training: NonNullable<typeof selfPaced>,
        targetSession?: NonNullable<typeof session>,
      ) {
        const payment = await PaymentModel.create({
          learnerId: targetLearner._id,
          trainingId: training._id,
          ...(targetSession === undefined
            ? {}
            : { sessionId: targetSession._id }),
          purchaseType:
            targetSession === undefined ? 'SELF_PACED_ONLINE' : 'IN_PERSON',
          status: 'PAID',
          amountMinor: training.priceMinor,
          currency: 'TND',
          trainingTitle: training.title,
          ...(targetSession === undefined
            ? {}
            : { sessionTitle: targetSession.title }),
          stripeCheckoutSessionId: `cs_test_phase67_${new mongoose.Types.ObjectId()}`,
          stripePaymentIntentId: `pi_test_phase67_${new mongoose.Types.ObjectId()}`,
          paidAt: new Date(),
        });
        return await EnrollmentModel.create({
          learnerId: targetLearner._id,
          trainingId: training._id,
          sessionId: targetSession?._id ?? null,
          paymentId: payment._id,
        });
      }

      const selfEnrollment = await paidEnrollment(learner, selfPaced);
      const firstSessionEnrollment = await paidEnrollment(
        learner,
        inPerson,
        session,
      );
      const secondSessionEnrollment = await paidEnrollment(
        secondLearner,
        inPerson,
        session,
      );
      const config = loadAppConfig({
        ...validEnvironment(),
        MONGODB_URI: requiredUri(),
      });
      const app = createApp({
        config,
        logger: pino({ level: 'silent' }),
        databaseReady: () => true,
        passwordResetMailService: mailService,
      });
      async function login(email: string) {
        const result = await request(app).post('/api/auth/login').send({
          email,
          password,
          client: 'MOBILE',
        });
        expect(result.status).toBe(200);
        return String(result.body.accessToken);
      }
      return {
        app,
        users: { admin, owner, assigned, learner, secondLearner, outsider },
        trainings: { selfPaced, inPerson },
        module,
        lessons: { lessonOne, lessonTwo },
        session,
        schedules: { scheduleOne, scheduleTwo },
        enrollments: {
          selfEnrollment,
          firstSessionEnrollment,
          secondSessionEnrollment,
        },
        tokens: {
          admin: await login(admin.email),
          owner: await login(owner.email),
          assigned: await login(assigned.email),
          learner: await login(learner.email),
          secondLearner: await login(secondLearner.email),
          outsider: await login(outsider.email),
        },
      };
    }

    function authorized(token: string) {
      return { authorization: `Bearer ${token}` };
    }

    it('calculates mark/unmark progression, enforces paid access, and locks the Certificate snapshot', async () => {
      const { app, users, trainings, module, lessons, enrollments, tokens } =
        await setup();
      expect(
        (await request(app).get('/api/progress').set(authorized(tokens.owner)))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put(`/api/progress/lessons/${String(lessons.lessonOne._id)}`)
            .set(authorized(tokens.outsider))
            .send({ completed: true })
        ).status,
      ).toBe(403);

      const initial = await request(app)
        .get(`/api/progress?trainingId=${String(trainings.selfPaced._id)}`)
        .set(authorized(tokens.learner));
      expect(initial.status).toBe(200);
      expect(initial.body.items[0]).toMatchObject({
        completedLessonCount: 0,
        totalLessonCount: 2,
        percentage: 0,
        isComplete: false,
        lockedByCertificate: false,
      });

      const first = await request(app)
        .put(`/api/progress/lessons/${String(lessons.lessonOne._id)}`)
        .set(authorized(tokens.learner))
        .send({ completed: true });
      expect(first.status).toBe(200);
      expect(first.body.percentage).toBe(50);
      const firstCompletedAt = first.body.lessons[0].completedAt;
      const repeated = await request(app)
        .put(`/api/progress/lessons/${String(lessons.lessonOne._id)}`)
        .set(authorized(tokens.learner))
        .send({ completed: true });
      expect(repeated.body.lessons[0].completedAt).toBe(firstCompletedAt);
      expect(await LessonProgressModel.countDocuments()).toBe(1);

      const complete = await request(app)
        .put(`/api/progress/lessons/${String(lessons.lessonTwo._id)}`)
        .set(authorized(tokens.learner))
        .send({ completed: true });
      expect(complete.body).toMatchObject({
        percentage: 100,
        isComplete: true,
      });
      const unmarked = await request(app)
        .put(`/api/progress/lessons/${String(lessons.lessonTwo._id)}`)
        .set(authorized(tokens.learner))
        .send({ completed: false });
      expect(unmarked.body).toMatchObject({
        percentage: 50,
        isComplete: false,
      });
      await request(app)
        .put(`/api/progress/lessons/${String(lessons.lessonTwo._id)}`)
        .set(authorized(tokens.learner))
        .send({ completed: true });

      const issuedAt = new Date();
      await mongoose.connection.collection('certificates').insertOne({
        enrollmentId: enrollments.selfEnrollment._id,
        learnerId: users.learner._id,
        trainingId: trainings.selfPaced._id,
        issuedAt,
        createdAt: issuedAt,
      });
      // Legacy/demo imports can have a technical Lesson createdAt later than
      // issuance even though their completed progress predates the Certificate.
      await mongoose.connection
        .collection('lessons')
        .updateOne(
          { _id: lessons.lessonOne._id },
          { $set: { createdAt: new Date(issuedAt.getTime() + 500) } },
        );
      await LessonModel.create({
        trainingId: trainings.selfPaced._id,
        moduleId: module._id,
        title: 'Nouvelle leçon après certificat',
        description: '',
        textContent: '',
        instructions: '',
        order: 3,
        isArchived: false,
        createdAt: new Date(issuedAt.getTime() + 1_000),
        updatedAt: new Date(issuedAt.getTime() + 1_000),
      });
      const locked = await request(app)
        .get('/api/progress')
        .set(authorized(tokens.learner));
      expect(locked.body.items[0]).toMatchObject({
        totalLessonCount: 2,
        percentage: 100,
        isComplete: true,
        lockedByCertificate: true,
      });
      expect(
        (
          await request(app)
            .put(`/api/progress/lessons/${String(lessons.lessonOne._id)}`)
            .set(authorized(tokens.learner))
            .send({ completed: false })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .delete(`/api/lessons/${String(lessons.lessonOne._id)}`)
            .set(authorized(tokens.owner))
        ).status,
      ).toBe(409);
    });

    it('distinguishes missing Attendance, authorizes assigned staff, gates completion, calculates thresholds, and locks records', async () => {
      const { app, session, schedules, enrollments, tokens } = await setup();
      const learnerSessions = await request(app)
        .get('/api/sessions?view=ENROLLED')
        .set(authorized(tokens.learner));
      expect(learnerSessions.status).toBe(200);
      expect(learnerSessions.body.items).toHaveLength(1);

      const initial = await request(app)
        .get(`/api/sessions/${String(session._id)}/attendance`)
        .set(authorized(tokens.learner));
      expect(initial.status).toBe(200);
      expect(initial.body.roster).toHaveLength(1);
      expect(initial.body.roster[0]).toMatchObject({
        presentCount: 0,
        recordedCount: 0,
        attendanceCoverageComplete: false,
      });
      expect(initial.body.roster[0].records[0].status).toBeNull();
      expect(
        (
          await request(app)
            .get(`/api/sessions/${String(session._id)}/attendance`)
            .set(authorized(tokens.owner))
        ).status,
      ).toBe(403);

      const firstSheet = {
        entries: [
          {
            enrollmentId: String(enrollments.firstSessionEnrollment._id),
            status: 'PRESENT',
          },
          {
            enrollmentId: String(enrollments.secondSessionEnrollment._id),
            status: 'ABSENT',
          },
        ],
      };
      expect(
        (
          await request(app)
            .put(
              `/api/schedules/${String(schedules.scheduleOne._id)}/attendance`,
            )
            .set(authorized(tokens.owner))
            .send(firstSheet)
        ).status,
      ).toBe(403);
      expect(
        (
          await request(app)
            .put(
              `/api/schedules/${String(schedules.scheduleOne._id)}/attendance`,
            )
            .set(authorized(tokens.assigned))
            .send(firstSheet)
        ).status,
      ).toBe(200);
      expect(await AttendanceModel.countDocuments()).toBe(2);

      expect(
        (
          await request(app)
            .post(`/api/sessions/${String(session._id)}/start`)
            .set(authorized(tokens.assigned))
        ).status,
      ).toBe(200);
      const incomplete = await request(app)
        .post(`/api/sessions/${String(session._id)}/complete`)
        .set(authorized(tokens.assigned));
      expect(incomplete.status).toBe(409);
      expect(incomplete.body.error.code).toBe('ATTENDANCE_INCOMPLETE');

      const secondSheet = {
        entries: [
          {
            enrollmentId: String(enrollments.firstSessionEnrollment._id),
            status: 'PRESENT',
          },
          {
            enrollmentId: String(enrollments.secondSessionEnrollment._id),
            status: 'PRESENT',
          },
        ],
      };
      expect(
        (
          await request(app)
            .put(
              `/api/schedules/${String(schedules.scheduleTwo._id)}/attendance`,
            )
            .set(authorized(tokens.admin))
            .send(secondSheet)
        ).status,
      ).toBe(200);
      expect(await AttendanceModel.countDocuments()).toBe(4);

      expect(
        (
          await request(app)
            .post(`/api/sessions/${String(session._id)}/complete`)
            .set(authorized(tokens.assigned))
        ).status,
      ).toBe(200);
      const lockedWrite = await request(app)
        .put(`/api/schedules/${String(schedules.scheduleOne._id)}/attendance`)
        .set(authorized(tokens.admin))
        .send(firstSheet);
      expect(lockedWrite.status).toBe(409);
      expect(lockedWrite.body.error.code).toBe('ATTENDANCE_IMMUTABLE');

      const firstLearner = await request(app)
        .get(`/api/sessions/${String(session._id)}/attendance`)
        .set(authorized(tokens.learner));
      expect(firstLearner.body.roster[0]).toMatchObject({
        attendancePercentage: 100,
        attendanceCoverageComplete: true,
        meetsAttendanceThreshold: true,
        isComplete: true,
      });
      const secondLearner = await request(app)
        .get(`/api/sessions/${String(session._id)}/attendance`)
        .set(authorized(tokens.secondLearner));
      expect(secondLearner.body.roster[0]).toMatchObject({
        attendancePercentage: 50,
        attendanceCoverageComplete: true,
        meetsAttendanceThreshold: false,
        isComplete: false,
      });
    });
  },
);

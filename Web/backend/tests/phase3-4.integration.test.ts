import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
import { SessionScheduleModel } from '../src/modules/sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../src/modules/sessions/models/training-session.model.js';
import { TrainingCategoryModel } from '../src/modules/trainings/models/training-category.model.js';
import { TrainingModel } from '../src/modules/trainings/models/training.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import { hashPassword } from '../src/shared/auth/password.js';
import { validEnvironment } from './fixtures/environment.js';

const integrationDatabaseUri = process.env.TEST_MONGODB_URI;
const integrationDescribe =
  integrationDatabaseUri === undefined ? describe.skip : describe;

function requiredDatabaseUri(): string {
  if (integrationDatabaseUri === undefined) {
    throw new Error(
      'TEST_MONGODB_URI is required for Phase 3-4 integration tests.',
    );
  }
  if (
    new URL(integrationDatabaseUri).pathname.slice(1) !==
    'plateforme_formations_integration'
  ) {
    throw new Error(
      'TEST_MONGODB_URI must use the plateforme_formations_integration database.',
    );
  }
  return integrationDatabaseUri;
}

integrationDescribe('Phase 3 and 4 real HTTP integration', () => {
  const mailService: PasswordResetMailService = {
    async sendPasswordReset() {},
  };
  let uploadRoot = '';

  async function cleanDatabase() {
    await Promise.all([
      mongoose.connection.collection('attendances').deleteMany({}),
      mongoose.connection.collection('resource_progress').deleteMany({}),
      mongoose.connection.collection('lesson_progress').deleteMany({}),
      mongoose.connection.collection('enrollments').deleteMany({}),
      mongoose.connection.collection('payments').deleteMany({}),
      SessionScheduleModel.deleteMany({}),
      TrainingSessionModel.deleteMany({}),
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
    uploadRoot = await mkdtemp(path.join(tmpdir(), 'plateforme-content-'));
    await mongoose.connect(requiredDatabaseUri());
    await cleanDatabase();
    await initializeDatabaseIndexes();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await rm(uploadRoot, { recursive: true, force: true });
    await mkdir(uploadRoot, { recursive: true });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await cleanDatabase();
      await mongoose.disconnect();
    }
    await rm(uploadRoot, { recursive: true, force: true });
  });

  async function setup() {
    const passwordHash = await hashPassword('Phase34-password-123!');
    const [admin, owner, assigned, otherTrainer, learner] =
      await UserModel.create([
        {
          email: 'admin.phase34@example.com',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Admin', lastName: 'Phase 34' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'owner.phase34@example.com',
          passwordHash,
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Owner', lastName: 'Trainer' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'assigned.phase34@example.com',
          passwordHash,
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Assigned', lastName: 'Trainer' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'other.phase34@example.com',
          passwordHash,
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Other', lastName: 'Trainer' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'learner.phase34@example.com',
          passwordHash,
          role: 'LEARNER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Learner', lastName: 'Phase 34' },
          passwordChangedAt: new Date(),
        },
      ]);
    if (
      admin === undefined ||
      owner === undefined ||
      assigned === undefined ||
      otherTrainer === undefined ||
      learner === undefined
    ) {
      throw new Error('Integration users were not created.');
    }
    const category = await TrainingCategoryModel.create({
      name: 'Ingénierie',
      normalizedName: 'ingénierie',
      description: 'Contenu technique.',
      isArchived: false,
    });
    const common = {
      description: 'Formation de test complète.',
      categoryId: category._id,
      level: 'Intermédiaire',
      durationMinutes: 600,
      objectives: ['Appliquer les concepts'],
      prerequisites: ['Bases techniques'],
      priceMinor: 30_000,
      currency: 'TND' as const,
      ownerTrainerId: owner._id,
    };
    const [selfPaced, inPerson] = await TrainingModel.create([
      {
        ...common,
        title: 'Architecture TypeScript',
        type: 'SELF_PACED_ONLINE',
        status: 'DRAFT',
      },
      {
        ...common,
        title: 'Atelier présentiel',
        type: 'IN_PERSON',
        status: 'PUBLISHED',
        minimumAttendancePercent: 80,
      },
    ]);
    if (selfPaced === undefined || inPerson === undefined) {
      throw new Error('Integration Trainings were not created.');
    }
    const config = loadAppConfig({
      ...validEnvironment(),
      MONGODB_URI: requiredDatabaseUri(),
      UPLOAD_DIR: uploadRoot,
      MAX_UPLOAD_SIZE_MB: '1',
    });
    const app = createApp({
      config,
      logger: pino({ level: 'silent' }),
      databaseReady: () => true,
      passwordResetMailService: mailService,
    });
    async function login(email: string): Promise<string> {
      const response = await request(app).post('/api/auth/login').send({
        email,
        password: 'Phase34-password-123!',
        client: 'MOBILE',
      });
      expect(response.status).toBe(200);
      return String(response.body.accessToken);
    }
    const [adminToken, ownerToken, assignedToken, otherToken, learnerToken] =
      await Promise.all([
        login(admin.email),
        login(owner.email),
        login(assigned.email),
        login(otherTrainer.email),
        login(learner.email),
      ]);
    return {
      app,
      users: { admin, owner, assigned, otherTrainer, learner },
      trainings: { selfPaced, inPerson },
      tokens: {
        adminToken,
        ownerToken,
        assignedToken,
        otherToken,
        learnerToken,
      },
    };
  }

  it('enforces content ownership, enrollment access, publication, file safety, and history rules', async () => {
    const { app, users, trainings, tokens } = await setup();
    const moduleCreation = await request(app)
      .post(`/api/trainings/${String(trainings.selfPaced._id)}/modules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({ title: 'Fondations', description: 'Premier module', order: 1 });
    expect(moduleCreation.status).toBe(201);
    const moduleId = String(moduleCreation.body.id);
    expect(
      (
        await request(app)
          .post(`/api/trainings/${String(trainings.selfPaced._id)}/modules`)
          .set('authorization', `Bearer ${tokens.ownerToken}`)
          .send({ title: 'Ordre dupliqué', order: 1 })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .post(`/api/modules/${moduleId}/lessons`)
          .set('authorization', `Bearer ${tokens.otherToken}`)
          .send({ title: 'Interdit', order: 1 })
      ).status,
    ).toBe(403);

    const lessonCreation = await request(app)
      .post(`/api/modules/${moduleId}/lessons`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        title: 'Types stricts',
        description: 'Modélisation du domaine',
        textContent: 'Le contenu pédagogique réel.',
        instructions: 'Lire puis pratiquer.',
        order: 1,
      });
    expect(lessonCreation.status).toBe(201);
    const lessonId = String(lessonCreation.body.id);

    const hiddenLink = await request(app)
      .post(`/api/lessons/${lessonId}/resources`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        title: 'Notes formateur',
        order: 1,
        type: 'EXTERNAL_URL',
        externalUrl: 'https://example.test/notes',
        isVisibleToLearners: false,
      });
    expect(hiddenLink.status).toBe(201);
    expect(
      (
        await request(app)
          .post(`/api/lessons/${lessonId}/resources`)
          .set('authorization', `Bearer ${tokens.ownerToken}`)
          .send({
            title: 'URL invalide',
            order: 2,
            type: 'EXTERNAL_URL',
            externalUrl: 'file:///etc/passwd',
          })
      ).status,
    ).toBe(422);

    const fileCreation = await request(app)
      .post(`/api/lessons/${lessonId}/resources`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .field('title', 'Guide pratique')
      .field('description', 'Exercice à télécharger')
      .field('order', '2')
      .field('type', 'FILE')
      .field('isVisibleToLearners', 'true')
      .attach('file', Buffer.from('contenu sûr'), {
        filename: 'guide.txt',
        contentType: 'text/plain',
      });
    expect(fileCreation.status).toBe(201);
    const fileResourceId = String(fileCreation.body.id);
    const storedResource =
      await TrainingResourceModel.findById(fileResourceId).exec();
    const relativePath = storedResource?.file?.relativePath;
    expect(relativePath).toBeDefined();
    await expect(
      stat(path.join(uploadRoot, String(relativePath))),
    ).resolves.toBeDefined();

    const fakePdf = await request(app)
      .post(`/api/lessons/${lessonId}/resources`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .field('title', 'Faux PDF')
      .field('order', '3')
      .field('type', 'FILE')
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      });
    expect(fakePdf.status).toBe(422);
    expect(fakePdf.body.error.code).toBe('FILE_SIGNATURE_MISMATCH');

    const published = await request(app)
      .post(`/api/trainings/${String(trainings.selfPaced._id)}/publish`)
      .set('authorization', `Bearer ${tokens.ownerToken}`);
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('PUBLISHED');

    expect(
      (
        await request(app)
          .get(`/api/trainings/${String(trainings.selfPaced._id)}/content`)
          .set('authorization', `Bearer ${tokens.learnerToken}`)
      ).status,
    ).toBe(403);
    await mongoose.connection.collection('enrollments').insertOne({
      learnerId: users.learner._id,
      trainingId: trainings.selfPaced._id,
      paymentId: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
    });
    const learnerContent = await request(app)
      .get(`/api/trainings/${String(trainings.selfPaced._id)}/content`)
      .set('authorization', `Bearer ${tokens.learnerToken}`);
    expect(learnerContent.status).toBe(200);
    expect(learnerContent.body.access).toBe('LEARNER_READ');
    expect(learnerContent.body.modules[0].lessons[0].resources).toHaveLength(1);
    expect(learnerContent.body.modules[0].lessons[0].resources[0].id).toBe(
      fileResourceId,
    );
    const download = await request(app)
      .get(`/api/resources/${fileResourceId}/download`)
      .set('authorization', `Bearer ${tokens.learnerToken}`);
    expect(download.status).toBe(200);
    expect(download.text).toBe('contenu sûr');
    expect(
      (
        await request(app)
          .get(`/api/resources/${fileResourceId}/download`)
          .set('authorization', `Bearer ${tokens.otherToken}`)
      ).status,
    ).toBe(403);

    await mongoose.connection.collection('lesson_progress').insertOne({
      enrollmentId: new mongoose.Types.ObjectId(),
      lessonId: new mongoose.Types.ObjectId(lessonId),
      completed: false,
    });
    const blockedDelete = await request(app)
      .delete(`/api/lessons/${lessonId}`)
      .set('authorization', `Bearer ${tokens.ownerToken}`);
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.body.error.code).toBe('CONTENT_HAS_PROGRESS');
    const archived = await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({ isArchived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.isArchived).toBe(true);
    expect(
      (
        await request(app)
          .get(`/api/trainings/${String(trainings.selfPaced._id)}/content`)
          .set('authorization', `Bearer ${tokens.learnerToken}`)
      ).body.modules[0].lessons,
    ).toHaveLength(0);
    await request(app)
      .put(`/api/lessons/${lessonId}`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({ isArchived: false })
      .expect(200);

    await request(app)
      .delete(`/api/resources/${fileResourceId}`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .expect(204);
    await expect(
      stat(path.join(uploadRoot, String(relativePath))),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  }, 60_000);

  it('enforces multi-date schedules, assignments, Tunisia instants, conflicts, lifecycle, and history', async () => {
    const { app, users, trainings, tokens } = await setup();
    const selfPacedSession = await request(app)
      .post('/api/sessions')
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        trainingId: String(trainings.selfPaced._id),
        title: 'Session impossible',
        capacity: 10,
        location: 'Centre Tunis',
      });
    expect(selfPacedSession.status).toBe(422);

    const creation = await request(app)
      .post('/api/sessions')
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        trainingId: String(trainings.inPerson._id),
        title: 'Avril 2026',
        identifier: 'AVRIL-2026',
        capacity: 12,
        location: 'Centre Tunis',
        address: '1 avenue de Tunis',
        room: 'Salle A',
      });
    expect(creation.status).toBe(201);
    const sessionId = String(creation.body.id);
    expect(creation.body.assignedTrainers).toHaveLength(1);

    await request(app)
      .put(`/api/sessions/${sessionId}/trainers`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        assignedTrainerIds: [
          String(users.owner._id),
          String(users.assigned._id),
        ],
      })
      .expect(200);
    expect(
      (
        await request(app)
          .put(`/api/sessions/${sessionId}`)
          .set('authorization', `Bearer ${tokens.assignedToken}`)
          .send({ title: 'Modification interdite' })
      ).status,
    ).toBe(403);

    const invalidLocalTime = await request(app)
      .post(`/api/sessions/${sessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-01T09:00:00',
        endAt: '2026-04-01T10:00:00',
        trainerIds: [String(users.owner._id)],
      });
    expect(invalidLocalTime.status).toBe(422);

    const firstSchedule = await request(app)
      .post(`/api/sessions/${sessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-01T09:00:00+01:00',
        endAt: '2026-04-01T10:00:00+01:00',
        trainerIds: [String(users.owner._id)],
      });
    expect(firstSchedule.status).toBe(201);
    expect(firstSchedule.body.startAt).toBe('2026-04-01T08:00:00.000Z');
    await request(app)
      .post(`/api/sessions/${sessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-01T10:00:00+01:00',
        endAt: '2026-04-01T11:00:00+01:00',
        trainerIds: [String(users.owner._id)],
      })
      .expect(201);

    const trainerConflict = await request(app)
      .post(`/api/sessions/${sessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-01T09:30:00+01:00',
        endAt: '2026-04-01T10:30:00+01:00',
        trainerIds: [String(users.owner._id)],
        room: 'Salle B',
      });
    expect(trainerConflict.status).toBe(409);
    expect(trainerConflict.body.error.code).toBe('SCHEDULE_TRAINER_CONFLICT');

    const roomConflict = await request(app)
      .post(`/api/sessions/${sessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-01T09:30:00+01:00',
        endAt: '2026-04-01T10:30:00+01:00',
        trainerIds: [String(users.assigned._id)],
        location: '  CENTRE   TUNIS ',
        room: ' salle a ',
      });
    expect(roomConflict.status).toBe(409);
    expect(roomConflict.body.error.code).toBe('SCHEDULE_ROOM_CONFLICT');
    await request(app)
      .post(`/api/sessions/${sessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-01T09:30:00+01:00',
        endAt: '2026-04-01T10:30:00+01:00',
        trainerIds: [String(users.assigned._id)],
        room: 'Salle B',
      })
      .expect(201);

    const removal = await request(app)
      .put(`/api/sessions/${sessionId}/trainers`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({ assignedTrainerIds: [String(users.owner._id)] });
    expect(removal.status).toBe(409);
    expect(removal.body.error.code).toBe('TRAINER_USED_BY_SCHEDULE');

    const publicList = await request(app).get('/api/sessions');
    expect(publicList.status).toBe(200);
    expect(publicList.body.total).toBe(1);
    const publicDetail = await request(app).get(`/api/sessions/${sessionId}`);
    expect(publicDetail.body).toMatchObject({
      startAt: '2026-04-01T08:00:00.000Z',
      endAt: '2026-04-01T10:00:00.000Z',
    });

    expect(
      (
        await request(app)
          .post(`/api/sessions/${sessionId}/start`)
          .set('authorization', `Bearer ${tokens.otherToken}`)
      ).status,
    ).toBe(403);
    const started = await request(app)
      .post(`/api/sessions/${sessionId}/start`)
      .set('authorization', `Bearer ${tokens.assignedToken}`);
    expect(started.body.status).toBe('IN_PROGRESS');
    expect(
      (
        await request(app)
          .put(`/api/sessions/${sessionId}`)
          .set('authorization', `Bearer ${tokens.ownerToken}`)
          .send({ capacity: 20 })
      ).status,
    ).toBe(409);
    const completed = await request(app)
      .post(`/api/sessions/${sessionId}/complete`)
      .set('authorization', `Bearer ${tokens.assignedToken}`);
    expect(completed.body.status).toBe('COMPLETED');

    const coverageSession = await request(app)
      .post('/api/sessions')
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        trainingId: String(trainings.inPerson._id),
        title: 'Couverture présence',
        capacity: 5,
        location: 'Centre B',
        room: 'Salle 1',
      });
    const coverageSessionId = String(coverageSession.body.id);
    const coverageSchedule = await request(app)
      .post(`/api/sessions/${coverageSessionId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-03T09:00:00+01:00',
        endAt: '2026-04-03T10:00:00+01:00',
        trainerIds: [String(users.owner._id)],
      });
    await request(app)
      .post(`/api/sessions/${coverageSessionId}/start`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .expect(200);
    const enrollmentId = new mongoose.Types.ObjectId();
    await mongoose.connection.collection('enrollments').insertOne({
      _id: enrollmentId,
      learnerId: users.learner._id,
      trainingId: trainings.inPerson._id,
      sessionId: new mongoose.Types.ObjectId(coverageSessionId),
      paymentId: new mongoose.Types.ObjectId(),
    });
    expect(
      (
        await request(app)
          .post(`/api/sessions/${coverageSessionId}/cancel`)
          .set('authorization', `Bearer ${tokens.ownerToken}`)
      ).status,
    ).toBe(409);
    const incomplete = await request(app)
      .post(`/api/sessions/${coverageSessionId}/complete`)
      .set('authorization', `Bearer ${tokens.ownerToken}`);
    expect(incomplete.status).toBe(409);
    expect(incomplete.body.error.code).toBe('ATTENDANCE_INCOMPLETE');
    await mongoose.connection.collection('attendances').insertOne({
      enrollmentId,
      scheduleId: new mongoose.Types.ObjectId(String(coverageSchedule.body.id)),
      status: 'PRESENT',
    });
    await request(app)
      .post(`/api/sessions/${coverageSessionId}/complete`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .expect(200);

    const deletable = await request(app)
      .post('/api/sessions')
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        trainingId: String(trainings.inPerson._id),
        title: 'Supprimable',
        capacity: 3,
        location: 'Centre C',
      });
    const deletableId = String(deletable.body.id);
    await request(app)
      .post(`/api/sessions/${deletableId}/schedules`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        startAt: '2026-04-05T09:00:00+01:00',
        endAt: '2026-04-05T10:00:00+01:00',
        trainerIds: [String(users.owner._id)],
      })
      .expect(201);
    await request(app)
      .delete(`/api/sessions/${deletableId}`)
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .expect(204);
    expect(
      await SessionScheduleModel.exists({ sessionId: deletableId }),
    ).toBeNull();

    const historical = await request(app)
      .post('/api/sessions')
      .set('authorization', `Bearer ${tokens.ownerToken}`)
      .send({
        trainingId: String(trainings.inPerson._id),
        title: 'Avec paiement',
        capacity: 3,
        location: 'Centre D',
      });
    const historicalId = String(historical.body.id);
    await mongoose.connection.collection('payments').insertOne({
      sessionId: new mongoose.Types.ObjectId(historicalId),
      status: 'PENDING',
    });
    const blockedDelete = await request(app)
      .delete(`/api/sessions/${historicalId}`)
      .set('authorization', `Bearer ${tokens.ownerToken}`);
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.body.error.code).toBe('SESSION_HAS_HISTORY');
  }, 60_000);
});

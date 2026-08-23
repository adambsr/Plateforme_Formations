import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import type { PasswordResetMailService } from '../src/infrastructure/mail/password-reset-mail.js';
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
      'TEST_MONGODB_URI is required for Phase 2 integration tests.',
    );
  }
  const databaseName = new URL(integrationDatabaseUri).pathname.slice(1);
  if (databaseName !== 'plateforme_formations_integration') {
    throw new Error(
      'TEST_MONGODB_URI must use the plateforme_formations_integration database.',
    );
  }
  return integrationDatabaseUri;
}

integrationDescribe(
  'Phase 2 Training catalogue and ownership integration',
  () => {
    const mailService: PasswordResetMailService = {
      async sendPasswordReset() {},
    };

    async function cleanDatabase() {
      await Promise.all([
        mongoose.connection.collection('training_sessions').deleteMany({}),
        TrainingModel.deleteMany({}),
        TrainingCategoryModel.deleteMany({}),
        mongoose.connection.collection('password_reset_tokens').deleteMany({}),
        mongoose.connection.collection('refresh_sessions').deleteMany({}),
        UserModel.deleteMany({}),
      ]);
    }

    beforeAll(async () => {
      await mongoose.connect(requiredDatabaseUri());
      await cleanDatabase();
      await initializeDatabaseIndexes();
    });

    afterAll(async () => {
      if (mongoose.connection.readyState !== 0) {
        await cleanDatabase();
        await mongoose.disconnect();
      }
    });

    it('enforces catalogue visibility, ownership, immutable modality, lifecycle, and deletion rules', async () => {
      const passwordHash = await hashPassword('Phase2-password-123!');
      const createdUsers = await UserModel.create([
        {
          email: 'admin.phase2@example.com',
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Admin', lastName: 'Phase Two' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'owner.phase2@example.com',
          passwordHash,
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Owner', lastName: 'Trainer' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'next-owner.phase2@example.com',
          passwordHash,
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Next', lastName: 'Owner' },
          passwordChangedAt: new Date(),
        },
        {
          email: 'learner.phase2@example.com',
          passwordHash,
          role: 'LEARNER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Learner', lastName: 'Phase Two' },
          passwordChangedAt: new Date(),
        },
      ]);
      const [admin, owner, nextOwner, learner] = createdUsers;
      if (
        admin === undefined ||
        owner === undefined ||
        nextOwner === undefined ||
        learner === undefined
      ) {
        throw new Error('Phase 2 integration users were not created.');
      }
      const config = loadAppConfig({
        ...validEnvironment(),
        MONGODB_URI: requiredDatabaseUri(),
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
          password: 'Phase2-password-123!',
          client: 'MOBILE',
        });
        expect(response.status).toBe(200);
        return String(response.body.accessToken);
      }

      const [adminToken, ownerToken, nextOwnerToken, learnerToken] =
        await Promise.all([
          login(admin.email),
          login(owner.email),
          login(nextOwner.email),
          login(learner.email),
        ]);

      const unauthenticatedCategory = await request(app)
        .post('/api/categories')
        .send({ name: 'Développement' });
      expect(unauthenticatedCategory.status).toBe(401);
      const trainerCategory = await request(app)
        .post('/api/categories')
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Développement' });
      expect(trainerCategory.status).toBe(403);

      const categoryCreation = await request(app)
        .post('/api/categories')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          name: ' Développement ',
          description: 'Formations de développement logiciel.',
        });
      expect(categoryCreation.status).toBe(201);
      expect(categoryCreation.body).toMatchObject({
        name: 'Développement',
        isArchived: false,
      });
      const categoryId = String(categoryCreation.body.id);
      const duplicateCategory = await request(app)
        .post('/api/categories')
        .set('authorization', `Bearer ${adminToken}`)
        .send({ name: 'développement' });
      expect(duplicateCategory.status).toBe(409);

      const publicCategories = await request(app).get('/api/categories');
      expect(publicCategories.status).toBe(200);
      expect(publicCategories.body).toHaveLength(1);

      const baseTraining = {
        title: 'TypeScript avancé',
        description: 'Formation approfondie au langage TypeScript.',
        categoryId,
        level: 'Avancé',
        durationMinutes: 720,
        objectives: ['Modéliser des domaines stricts'],
        prerequisites: ['JavaScript moderne'],
        type: 'SELF_PACED_ONLINE',
        priceMinor: 25_000,
      };

      const learnerCreation = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${learnerToken}`)
        .send(baseTraining);
      expect(learnerCreation.status).toBe(403);
      const freeTraining = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ ...baseTraining, priceMinor: 0 });
      expect(freeTraining.status).toBe(422);

      const selfPacedCreation = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${ownerToken}`)
        .send(baseTraining);
      expect(selfPacedCreation.status).toBe(201);
      expect(selfPacedCreation.body).toMatchObject({
        type: 'SELF_PACED_ONLINE',
        currency: 'EUR',
        status: 'DRAFT',
        ownerTrainer: { id: String(owner._id) },
      });
      const selfPacedId = String(selfPacedCreation.body.id);

      const publicDraftList = await request(app).get('/api/trainings');
      const publicDraftDetail = await request(app).get(
        `/api/trainings/${selfPacedId}`,
      );
      expect(publicDraftList.body.total).toBe(0);
      expect(publicDraftDetail.status).toBe(404);

      const otherTrainerUpdate = await request(app)
        .put(`/api/trainings/${selfPacedId}`)
        .set('authorization', `Bearer ${nextOwnerToken}`)
        .send({ title: 'Tentative interdite' });
      expect(otherTrainerUpdate.status).toBe(403);
      const immutableTypeAttempt = await request(app)
        .put(`/api/trainings/${selfPacedId}`)
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ type: 'IN_PERSON' });
      expect(immutableTypeAttempt.status).toBe(422);
      expect((await TrainingModel.findById(selfPacedId).exec())?.type).toBe(
        'SELF_PACED_ONLINE',
      );

      const selfPacedPublication = await request(app)
        .post(`/api/trainings/${selfPacedId}/publish`)
        .set('authorization', `Bearer ${ownerToken}`);
      expect(selfPacedPublication.status).toBe(409);
      expect(selfPacedPublication.body.error.code).toBe(
        'TRAINING_NOT_PUBLISHABLE',
      );

      const missingAdminOwner = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          ...baseTraining,
          title: 'Présentiel sans propriétaire',
          type: 'IN_PERSON',
        });
      expect(missingAdminOwner.status).toBe(422);
      expect(missingAdminOwner.body.error.code).toBe('OWNER_TRAINER_REQUIRED');

      const inPersonCreation = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${adminToken}`)
        .send({
          ...baseTraining,
          title: 'TypeScript en présentiel',
          type: 'IN_PERSON',
          ownerTrainerId: String(owner._id),
        });
      expect(inPersonCreation.status).toBe(201);
      expect(inPersonCreation.body.minimumAttendancePercent).toBe(80);
      const inPersonId = String(inPersonCreation.body.id);

      const published = await request(app)
        .post(`/api/trainings/${inPersonId}/publish`)
        .set('authorization', `Bearer ${ownerToken}`);
      expect(published.status).toBe(200);
      expect(published.body.status).toBe('PUBLISHED');
      const publicPublishedList = await request(app).get('/api/trainings');
      const publicPublishedDetail = await request(app).get(
        `/api/trainings/${inPersonId}`,
      );
      expect(publicPublishedList.body.total).toBe(1);
      expect(publicPublishedDetail.status).toBe(200);

      const trainerTransfer = await request(app)
        .put(`/api/trainings/${inPersonId}/owner`)
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ ownerTrainerId: String(nextOwner._id) });
      expect(trainerTransfer.status).toBe(403);
      const adminTransfer = await request(app)
        .put(`/api/trainings/${inPersonId}/owner`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({ ownerTrainerId: String(nextOwner._id) });
      expect(adminTransfer.status).toBe(200);
      expect(adminTransfer.body.ownerTrainer.id).toBe(String(nextOwner._id));

      const previousOwnerUpdate = await request(app)
        .put(`/api/trainings/${inPersonId}`)
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ title: 'Ancien propriétaire' });
      expect(previousOwnerUpdate.status).toBe(403);
      const newOwnerUpdate = await request(app)
        .put(`/api/trainings/${inPersonId}`)
        .set('authorization', `Bearer ${nextOwnerToken}`)
        .send({ title: 'Nouveau propriétaire' });
      expect(newOwnerUpdate.status).toBe(200);

      const archived = await request(app)
        .post(`/api/trainings/${inPersonId}/archive`)
        .set('authorization', `Bearer ${nextOwnerToken}`);
      expect(archived.status).toBe(200);
      expect(archived.body.status).toBe('ARCHIVED');
      expect((await request(app).get('/api/trainings')).body.total).toBe(0);
      expect(
        (await request(app).get(`/api/trainings/${inPersonId}`)).status,
      ).toBe(404);
      expect(
        (
          await request(app)
            .put(`/api/trainings/${inPersonId}`)
            .set('authorization', `Bearer ${nextOwnerToken}`)
            .send({ title: 'Modification archivée' })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .delete(`/api/trainings/${inPersonId}`)
            .set('authorization', `Bearer ${nextOwnerToken}`)
        ).status,
      ).toBe(204);

      const deletableDraft = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ ...baseTraining, title: 'Brouillon supprimable' });
      expect(
        (
          await request(app)
            .delete(`/api/trainings/${String(deletableDraft.body.id)}`)
            .set('authorization', `Bearer ${ownerToken}`)
        ).status,
      ).toBe(204);

      const historicalDraft = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ ...baseTraining, title: 'Brouillon avec historique' });
      const historicalDraftId = new mongoose.Types.ObjectId(
        String(historicalDraft.body.id),
      );
      await mongoose.connection.collection('training_sessions').insertOne({
        trainingId: historicalDraftId,
        createdAt: new Date(),
      });
      const blockedDeletion = await request(app)
        .delete(`/api/trainings/${String(historicalDraftId)}`)
        .set('authorization', `Bearer ${ownerToken}`);
      expect(blockedDeletion.status).toBe(409);
      expect(blockedDeletion.body.error.code).toBe('TRAINING_HAS_HISTORY');
      expect(
        await TrainingModel.exists({ _id: historicalDraftId }),
      ).not.toBeNull();

      const archivedCategory = await request(app)
        .put(`/api/categories/${categoryId}`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({ isArchived: true });
      expect(archivedCategory.body.isArchived).toBe(true);
      expect((await request(app).get('/api/categories')).body).toHaveLength(0);
      expect(
        (await request(app).get('/api/categories?includeArchived=true')).status,
      ).toBe(403);
      const adminCategories = await request(app)
        .get('/api/categories?includeArchived=true')
        .set('authorization', `Bearer ${adminToken}`);
      expect(adminCategories.status).toBe(200);
      expect(adminCategories.body).toHaveLength(1);
      const archivedCategoryCreation = await request(app)
        .post('/api/trainings')
        .set('authorization', `Bearer ${ownerToken}`)
        .send({ ...baseTraining, title: 'Catégorie archivée' });
      expect(archivedCategoryCreation.status).toBe(422);
      expect(archivedCategoryCreation.body.error.code).toBe(
        'ACTIVE_CATEGORY_REQUIRED',
      );

      const restoredCategory = await request(app)
        .put(`/api/categories/${categoryId}`)
        .set('authorization', `Bearer ${adminToken}`)
        .send({ isArchived: false, description: null });
      expect(restoredCategory.status).toBe(200);
      expect(restoredCategory.body).toMatchObject({
        isArchived: false,
      });
      expect(restoredCategory.body).not.toHaveProperty('description');
      expect((await request(app).get('/api/categories')).body).toHaveLength(1);

      const managed = await request(app)
        .get('/api/trainings?view=MANAGED&pageSize=100')
        .set('authorization', `Bearer ${adminToken}`);
      expect(managed.status).toBe(200);
      expect(managed.body.total).toBe(3);
    }, 60_000);
  },
);

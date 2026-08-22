import mongoose from 'mongoose';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { initializeDatabaseIndexes } from '../src/infrastructure/database/indexes.js';
import type { PasswordResetMailService } from '../src/infrastructure/mail/password-reset-mail.js';
import { PasswordResetTokenModel } from '../src/modules/auth/models/password-reset-token.model.js';
import { RefreshSessionModel } from '../src/modules/auth/models/refresh-session.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';
import { seedInitialAdmin } from '../src/modules/users/services/seed-initial-admin.js';
import { validEnvironment } from './fixtures/environment.js';

const integrationDatabaseUri = process.env.TEST_MONGODB_URI;
const integrationDescribe =
  integrationDatabaseUri === undefined ? describe.skip : describe;

function requiredDatabaseUri(): string {
  if (integrationDatabaseUri === undefined) {
    throw new Error(
      'TEST_MONGODB_URI is required for Phase 1 integration tests.',
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

integrationDescribe('Phase 1 authentication and users integration', () => {
  const resetUrls: string[] = [];
  const mailService: PasswordResetMailService = {
    async sendPasswordReset(_email, resetUrl) {
      resetUrls.push(resetUrl);
    },
  };

  beforeAll(async () => {
    await mongoose.connect(requiredDatabaseUri());
    await Promise.all([
      PasswordResetTokenModel.deleteMany({}),
      RefreshSessionModel.deleteMany({}),
      UserModel.deleteMany({}),
    ]);
    await initializeDatabaseIndexes();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await Promise.all([
        PasswordResetTokenModel.deleteMany({}),
        RefreshSessionModel.deleteMany({}),
        UserModel.deleteMany({}),
      ]);
      await mongoose.disconnect();
    }
  });

  it('enforces the complete Phase 1 identity lifecycle through real HTTP middleware', async () => {
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

    const learnerRegistration = await request(app)
      .post('/api/auth/register')
      .send({
        email: ' Learner.Phase1@example.com ',
        password: 'Learner-initial-123!',
        firstName: 'Grace',
        lastName: 'Hopper',
        client: 'WEB',
      });
    expect(learnerRegistration.status).toBe(201);
    expect(learnerRegistration.body.user).toMatchObject({
      email: 'learner.phase1@example.com',
      role: 'LEARNER',
      mustChangePassword: false,
    });
    expect(learnerRegistration.body.refreshToken).toBeUndefined();
    const registrationCookies = learnerRegistration.headers['set-cookie'];
    expect(registrationCookies?.[0]).toContain('refresh_token=');
    expect(registrationCookies?.[0]).toContain('HttpOnly');
    expect(registrationCookies?.[0]).toContain('SameSite=Lax');

    const privilegedRegistration = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'privileged.phase1@example.com',
        password: 'Learner-initial-123!',
        firstName: 'Bad',
        lastName: 'Actor',
        role: 'ADMIN',
      });
    expect(privilegedRegistration.status).toBe(422);
    expect(privilegedRegistration.body.error.code).toBe('VALIDATION_FAILED');
    expect(
      await UserModel.exists({ email: 'privileged.phase1@example.com' }),
    ).toBeNull();

    const duplicateRegistration = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'learner.phase1@example.com',
        password: 'Learner-initial-123!',
        firstName: 'Grace',
        lastName: 'Hopper',
      });
    expect(duplicateRegistration.status).toBe(409);

    const badLogin = await request(app).post('/api/auth/login').send({
      email: 'learner.phase1@example.com',
      password: 'wrong-password',
      client: 'MOBILE',
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.error.code).toBe('INVALID_CREDENTIALS');

    const learnerLogin = await request(app).post('/api/auth/login').send({
      email: 'learner.phase1@example.com',
      password: 'Learner-initial-123!',
      client: 'MOBILE',
    });
    expect(learnerLogin.status).toBe(200);
    const firstLearnerRefresh = String(learnerLogin.body.refreshToken);

    const rotated = await request(app).post('/api/auth/refresh').send({
      client: 'MOBILE',
      refreshToken: firstLearnerRefresh,
    });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(firstLearnerRefresh);
    const rotatedLearnerRefresh = String(rotated.body.refreshToken);

    const reuse = await request(app).post('/api/auth/refresh').send({
      client: 'MOBILE',
      refreshToken: firstLearnerRefresh,
    });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    const revokedReplacement = await request(app)
      .post('/api/auth/refresh')
      .send({ client: 'MOBILE', refreshToken: rotatedLearnerRefresh });
    expect(revokedReplacement.status).toBe(401);

    const firstAdminSeed = await seedInitialAdmin({
      email: ' Admin.Phase1@example.com ',
      password: 'Admin-initial-123!',
    });
    const secondAdminSeed = await seedInitialAdmin({
      email: 'ignored-admin@example.com',
      password: 'Ignored-admin-123!',
    });
    expect(firstAdminSeed).toMatchObject({
      email: 'admin.phase1@example.com',
      status: 'created',
    });
    expect(secondAdminSeed).toMatchObject({
      id: firstAdminSeed.id,
      status: 'unchanged',
    });
    expect(await UserModel.countDocuments({ role: 'ADMIN' })).toBe(1);

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin.phase1@example.com',
      password: 'Admin-initial-123!',
      client: 'MOBILE',
    });
    expect(adminLogin.body.user.mustChangePassword).toBe(true);
    const blockedAdminOperation = await request(app)
      .get('/api/trainers')
      .set('authorization', `Bearer ${String(adminLogin.body.accessToken)}`);
    expect(blockedAdminOperation.status).toBe(403);
    expect(blockedAdminOperation.body.error.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );

    const adminPasswordChange = await request(app)
      .post('/api/auth/change-password')
      .set('authorization', `Bearer ${String(adminLogin.body.accessToken)}`)
      .send({
        currentPassword: 'Admin-initial-123!',
        newPassword: 'Admin-permanent-456!',
        client: 'MOBILE',
      });
    expect(adminPasswordChange.status).toBe(200);
    expect(adminPasswordChange.body.user.mustChangePassword).toBe(false);
    const adminAccessToken = String(adminPasswordChange.body.accessToken);

    const trainerCreation = await request(app)
      .post('/api/trainers')
      .set('authorization', `Bearer ${adminAccessToken}`)
      .send({
        email: 'trainer.phase1@example.com',
        temporaryPassword: 'Trainer-initial-123!',
        firstName: 'Katherine',
        lastName: 'Johnson',
      });
    expect(trainerCreation.status).toBe(201);
    expect(trainerCreation.body).toMatchObject({
      role: 'TRAINER',
      mustChangePassword: true,
    });
    expect(trainerCreation.body.passwordHash).toBeUndefined();
    const trainerId = String(trainerCreation.body.id);

    const trainerLogin = await request(app).post('/api/auth/login').send({
      email: 'trainer.phase1@example.com',
      password: 'Trainer-initial-123!',
      client: 'MOBILE',
    });
    expect(trainerLogin.status).toBe(200);
    const trainerInitialAccess = String(trainerLogin.body.accessToken);
    const blockedTrainerOperation = await request(app)
      .get(`/api/trainers/${trainerId}`)
      .set('authorization', `Bearer ${trainerInitialAccess}`);
    expect(blockedTrainerOperation.status).toBe(403);
    expect(blockedTrainerOperation.body.error.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );

    const trainerPasswordChange = await request(app)
      .post('/api/auth/change-password')
      .set('authorization', `Bearer ${trainerInitialAccess}`)
      .send({
        currentPassword: 'Trainer-initial-123!',
        newPassword: 'Trainer-permanent-456!',
        client: 'MOBILE',
      });
    expect(trainerPasswordChange.status).toBe(200);
    const trainerAccessToken = String(trainerPasswordChange.body.accessToken);
    const trainerRefreshToken = String(trainerPasswordChange.body.refreshToken);

    const trainerProfileUpdate = await request(app)
      .put(`/api/trainers/${trainerId}`)
      .set('authorization', `Bearer ${trainerAccessToken}`)
      .send({ firstName: 'Katherine', lastName: 'Gobble Johnson' });
    expect(trainerProfileUpdate.status).toBe(200);
    expect(trainerProfileUpdate.body.profile.lastName).toBe('Gobble Johnson');

    const learnerBeforeReset = await request(app).post('/api/auth/login').send({
      email: 'learner.phase1@example.com',
      password: 'Learner-initial-123!',
      client: 'MOBILE',
    });
    const learnerAccessToken = String(learnerBeforeReset.body.accessToken);
    const learnerRefreshBeforeReset = String(
      learnerBeforeReset.body.refreshToken,
    );
    const learnerCannotAdminister = await request(app)
      .get('/api/users')
      .set('authorization', `Bearer ${learnerAccessToken}`);
    expect(learnerCannotAdminister.status).toBe(403);

    const learnerProfileUpdate = await request(app)
      .put('/api/auth/me')
      .set('authorization', `Bearer ${learnerAccessToken}`)
      .send({ firstName: 'Grace Brewster', lastName: 'Hopper' });
    expect(learnerProfileUpdate.status).toBe(200);

    const unknownForgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'unknown.phase1@example.com' });
    const knownForgot = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'learner.phase1@example.com' });
    expect(unknownForgot.status).toBe(202);
    expect(knownForgot.status).toBe(202);
    expect(unknownForgot.body).toEqual(knownForgot.body);
    expect(resetUrls).toHaveLength(1);

    const resetToken = new URL(resetUrls[0] as string).searchParams.get(
      'token',
    );
    expect(resetToken).not.toBeNull();
    const storedReset = await PasswordResetTokenModel.findOne({})
      .select('+tokenHash')
      .exec();
    expect(storedReset?.tokenHash).not.toBe(resetToken);

    const reset = await request(app).post('/api/auth/reset-password').send({
      token: resetToken,
      newPassword: 'Learner-permanent-456!',
    });
    expect(reset.status).toBe(204);
    const resetReuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, newPassword: 'Another-password-789!' });
    expect(resetReuse.status).toBe(400);
    expect(resetReuse.body.error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
    const refreshAfterReset = await request(app)
      .post('/api/auth/refresh')
      .send({
        client: 'MOBILE',
        refreshToken: learnerRefreshBeforeReset,
      });
    expect(refreshAfterReset.status).toBe(401);

    const oldPasswordLogin = await request(app).post('/api/auth/login').send({
      email: 'learner.phase1@example.com',
      password: 'Learner-initial-123!',
      client: 'MOBILE',
    });
    expect(oldPasswordLogin.status).toBe(401);
    const newPasswordLogin = await request(app).post('/api/auth/login').send({
      email: 'learner.phase1@example.com',
      password: 'Learner-permanent-456!',
      client: 'MOBILE',
    });
    expect(newPasswordLogin.status).toBe(200);
    const logoutRefresh = String(newPasswordLogin.body.refreshToken);
    const logout = await request(app).post('/api/auth/logout').send({
      client: 'MOBILE',
      refreshToken: logoutRefresh,
    });
    expect(logout.status).toBe(204);
    const refreshAfterLogout = await request(app)
      .post('/api/auth/refresh')
      .send({ client: 'MOBILE', refreshToken: logoutRefresh });
    expect(refreshAfterLogout.status).toBe(401);

    const trainers = await request(app)
      .get('/api/trainers?page=1&pageSize=10')
      .set('authorization', `Bearer ${adminAccessToken}`);
    expect(trainers.status).toBe(200);
    expect(trainers.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });

    const disabledTrainer = await request(app)
      .post(`/api/trainers/${trainerId}/disable`)
      .set('authorization', `Bearer ${adminAccessToken}`);
    expect(disabledTrainer.status).toBe(200);
    expect(disabledTrainer.body.isActive).toBe(false);
    const trainerAccessAfterDisable = await request(app)
      .get('/api/auth/me')
      .set('authorization', `Bearer ${trainerAccessToken}`);
    expect(trainerAccessAfterDisable.status).toBe(401);
    const trainerRefreshAfterDisable = await request(app)
      .post('/api/auth/refresh')
      .send({ client: 'MOBILE', refreshToken: trainerRefreshToken });
    expect(trainerRefreshAfterDisable.status).toBe(401);

    const persistedLearner = await UserModel.findOne({
      email: 'learner.phase1@example.com',
    })
      .select('+passwordHash')
      .exec();
    expect(persistedLearner?.passwordHash).not.toContain(
      'Learner-permanent-456!',
    );
    const persistedRefresh = await RefreshSessionModel.findOne({})
      .select('+tokenHash')
      .exec();
    expect(persistedRefresh?.tokenHash).not.toBe(logoutRefresh);
  }, 60_000);
});

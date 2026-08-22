import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  loadAdminSeedConfig,
  loadAppConfig,
  loadInitialAdminConfig,
} from '../src/config/environment.js';
import { validEnvironment } from './fixtures/environment.js';

describe('loadAppConfig', () => {
  it('returns a typed configuration and normalizes CSV and optional values', () => {
    const config = loadAppConfig(validEnvironment());

    expect(config.application.corsOrigins).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]);
    expect(config.smtp.secure).toBe(false);
    expect(config.smtp.user).toBeUndefined();
    expect(config.ai.baseUrl).toBeUndefined();
    expect(config.uploads.maxSizeMb).toBe(20);
  });

  it('uses only the documented defaults', () => {
    const environment = validEnvironment();
    delete environment.PORT;
    delete environment.TZ;
    delete environment.LOG_LEVEL;
    delete environment.JWT_ACCESS_TTL_MINUTES;
    delete environment.REFRESH_TOKEN_TTL_DAYS;
    delete environment.PASSWORD_RESET_TTL_MINUTES;
    delete environment.MAX_UPLOAD_SIZE_MB;
    delete environment.AI_MAX_CONTEXT_CHARS;

    const config = loadAppConfig(environment);

    expect(config.application).toMatchObject({
      port: 3000,
      timezone: 'UTC',
      logLevel: 'info',
    });
    expect(config.authentication).toMatchObject({
      jwtAccessTtlMinutes: 15,
      refreshTokenTtlDays: 7,
      passwordResetTtlMinutes: 30,
    });
    expect(config.uploads.maxSizeMb).toBe(20);
    expect(config.ai.maxContextChars).toBe(100_000);
  });

  it('reports missing variable names without exposing secret values', () => {
    const environment = validEnvironment();
    environment.JWT_ACCESS_SECRET = 'too-short-and-sensitive';
    delete environment.MONGODB_URI;

    expect(() => loadAppConfig(environment)).toThrow(ConfigurationError);

    try {
      loadAppConfig(environment);
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
      expect((error as Error).message).toContain('MONGODB_URI');
      expect((error as Error).message).toContain('JWT_ACCESS_SECRET');
      expect((error as Error).message).not.toContain('too-short-and-sensitive');
    }
  });

  it('rejects live Stripe keys and partial SMTP credentials', () => {
    const liveStripeEnvironment = validEnvironment();
    liveStripeEnvironment.STRIPE_SECRET_KEY = 'sk_live_forbidden';
    expect(() => loadAppConfig(liveStripeEnvironment)).toThrow(
      ConfigurationError,
    );

    const partialSmtpEnvironment = validEnvironment();
    partialSmtpEnvironment.SMTP_USER = 'mailer';
    expect(() => loadAppConfig(partialSmtpEnvironment)).toThrow(
      /SMTP_USER and SMTP_PASSWORD/,
    );
  });
});

describe('loadInitialAdminConfig', () => {
  it('validates seed-only variables independently of application startup', () => {
    expect(
      loadInitialAdminConfig({
        INITIAL_ADMIN_EMAIL: 'admin@example.com',
        INITIAL_ADMIN_PASSWORD: 'temporary-password',
      }),
    ).toEqual({ email: 'admin@example.com', password: 'temporary-password' });

    expect(() => loadInitialAdminConfig({})).toThrow(ConfigurationError);
  });

  it('loads the minimal typed runtime configuration for the seed command', () => {
    expect(
      loadAdminSeedConfig({
        MONGODB_URI: 'mongodb://localhost:27017/seed-test',
        INITIAL_ADMIN_EMAIL: 'admin@example.com',
        INITIAL_ADMIN_PASSWORD: 'temporary-password',
      }),
    ).toEqual({
      databaseUri: 'mongodb://localhost:27017/seed-test',
      logLevel: 'info',
      initialAdmin: {
        email: 'admin@example.com',
        password: 'temporary-password',
      },
    });
  });
});

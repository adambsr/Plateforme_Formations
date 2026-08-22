import { describe, expect, it } from 'vitest';

import { loadAppConfig } from '../src/config/environment.js';
import {
  changePasswordSchema,
  registerLearnerSchema,
} from '../src/modules/auth/dto/auth.dto.js';
import { TokenService } from '../src/modules/auth/services/token.service.js';
import { validEnvironment } from './fixtures/environment.js';

describe('authentication foundation', () => {
  it('accepts learner registration fields, normalizes the email, and defaults to Web', () => {
    const result = registerLearnerSchema.parse({
      email: ' LEARNER@Example.com ',
      password: 'a-secure-password',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
    });

    expect(result).toEqual({
      email: 'learner@example.com',
      password: 'a-secure-password',
      firstName: 'Ada',
      lastName: 'Lovelace',
      client: 'WEB',
    });
  });

  it('does not allow public registration to select a privileged role', () => {
    const result = registerLearnerSchema.safeParse({
      email: 'attacker@example.com',
      password: 'a-secure-password',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'ADMIN',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unchanged passwords', () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'a-secure-password',
        newPassword: 'a-secure-password',
      }).success,
    ).toBe(false);
  });

  it('signs and verifies access-token identity and role claims', async () => {
    const config = loadAppConfig(validEnvironment());
    const service = new TokenService(config.authentication);
    const token = await service.createAccessToken({
      userId: '507f1f77bcf86cd799439011',
      role: 'TRAINER',
    });

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      userId: '507f1f77bcf86cd799439011',
      role: 'TRAINER',
    });
    const [header, payload, signature] = token.split('.');
    if (
      header === undefined ||
      payload === undefined ||
      signature === undefined
    ) {
      throw new Error('The generated JWT is malformed.');
    }
    const tamperedSignature = `${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
    await expect(
      service.verifyAccessToken(`${header}.${payload}.${tamperedSignature}`),
    ).rejects.toThrow();
  });

  it('generates random opaque refresh tokens and stores only deterministic hashes', () => {
    const config = loadAppConfig(validEnvironment());
    const service = new TokenService(config.authentication);
    const now = new Date('2026-01-01T00:00:00.000Z');
    const first = service.createRefreshToken(now);
    const second = service.createRefreshToken(now);

    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.tokenHash).not.toBe(first.rawToken);
    expect(first.tokenHash).toBe(service.hashOpaqueToken(first.rawToken));
    expect(first.expiresAt.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });
});

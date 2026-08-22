import { describe, expect, it, vi } from 'vitest';

import type {
  AdminSeedRepository,
  CreateInitialAdminInput,
} from '../src/modules/users/repositories/admin-seed.repository.js';
import {
  AdminSeedConflictError,
  seedInitialAdmin,
} from '../src/modules/users/services/seed-initial-admin.js';

const seedConfig = {
  email: '  Admin@Example.COM ',
  password: 'temporary-password',
};

describe('seedInitialAdmin', () => {
  it('creates one active forced-change Admin using only a password hash', async () => {
    let createInput: CreateInitialAdminInput | undefined;
    const repository: AdminSeedRepository = {
      async findAdmin() {
        return null;
      },
      async findByEmail() {
        return null;
      },
      async createAdmin(input) {
        createInput = input;
        return { id: 'admin-id', email: input.email };
      },
    };
    const passwordHasher = vi.fn(async () => 'secure-password-hash');

    const result = await seedInitialAdmin(
      seedConfig,
      repository,
      passwordHasher,
    );

    expect(result).toEqual({
      status: 'created',
      id: 'admin-id',
      email: 'admin@example.com',
    });
    expect(passwordHasher).toHaveBeenCalledWith('temporary-password');
    expect(createInput).toMatchObject({
      email: 'admin@example.com',
      passwordHash: 'secure-password-hash',
    });
    expect(createInput?.passwordChangedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(createInput)).not.toContain('temporary-password');
  });

  it('is idempotent and does not hash or modify when any Admin exists', async () => {
    const passwordHasher = vi.fn(async () => 'unused');
    const repository: AdminSeedRepository = {
      async findAdmin() {
        return { id: 'existing-id', email: 'existing@example.com' };
      },
      async findByEmail() {
        throw new Error('must not be called');
      },
      async createAdmin() {
        throw new Error('must not be called');
      },
    };

    await expect(
      seedInitialAdmin(seedConfig, repository, passwordHasher),
    ).resolves.toEqual({
      status: 'unchanged',
      id: 'existing-id',
      email: 'existing@example.com',
    });
    expect(passwordHasher).not.toHaveBeenCalled();
  });

  it('refuses to promote an existing non-Admin account', async () => {
    const repository: AdminSeedRepository = {
      async findAdmin() {
        return null;
      },
      async findByEmail() {
        return { id: 'learner-id', email: 'admin@example.com' };
      },
      async createAdmin() {
        throw new Error('must not be called');
      },
    };

    await expect(
      seedInitialAdmin(seedConfig, repository),
    ).rejects.toBeInstanceOf(AdminSeedConflictError);
  });

  it('handles a concurrent successful seed as unchanged', async () => {
    let lookupCount = 0;
    const repository: AdminSeedRepository = {
      async findAdmin() {
        lookupCount += 1;
        return lookupCount === 1
          ? null
          : { id: 'winner-id', email: 'winner@example.com' };
      },
      async findByEmail() {
        return null;
      },
      async createAdmin() {
        throw new Error('duplicate key');
      },
    };

    await expect(
      seedInitialAdmin(seedConfig, repository, async () => 'hash'),
    ).resolves.toEqual({
      status: 'unchanged',
      id: 'winner-id',
      email: 'winner@example.com',
    });
  });
});

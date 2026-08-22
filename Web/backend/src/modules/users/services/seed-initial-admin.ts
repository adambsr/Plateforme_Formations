import type { InitialAdminConfig } from '../../../config/environment.js';
import { hashPassword } from '../../../shared/auth/password.js';
import {
  type AdminSeedRepository,
  mongooseAdminSeedRepository,
  type SeededUserReference,
} from '../repositories/admin-seed.repository.js';

export interface InitialAdminSeedResult extends SeededUserReference {
  status: 'created' | 'unchanged';
}

export class AdminSeedConflictError extends Error {
  constructor() {
    super('The initial Admin email already belongs to a non-Admin account.');
    this.name = 'AdminSeedConflictError';
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function seedInitialAdmin(
  config: InitialAdminConfig,
  repository: AdminSeedRepository = mongooseAdminSeedRepository,
  passwordHasher: (password: string) => Promise<string> = hashPassword,
): Promise<InitialAdminSeedResult> {
  const existingAdmin = await repository.findAdmin();
  if (existingAdmin !== null) {
    return { ...existingAdmin, status: 'unchanged' };
  }

  const email = normalizeEmail(config.email);
  if ((await repository.findByEmail(email)) !== null) {
    throw new AdminSeedConflictError();
  }

  const passwordHash = await passwordHasher(config.password);

  try {
    const createdAdmin = await repository.createAdmin({
      email,
      passwordHash,
      passwordChangedAt: new Date(),
    });
    return { ...createdAdmin, status: 'created' };
  } catch (error) {
    const concurrentlyCreatedAdmin = await repository.findAdmin();
    if (concurrentlyCreatedAdmin !== null) {
      return { ...concurrentlyCreatedAdmin, status: 'unchanged' };
    }
    throw error;
  }
}

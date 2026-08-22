import type { UserRole } from '../../core/auth/types.js';

export function roleHomePath(role: UserRole): string {
  if (role === 'ADMIN') return '/app/dashboard';
  if (role === 'TRAINER') return '/app/trainer';
  return '/app/learner';
}

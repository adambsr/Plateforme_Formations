import type { UserRole } from '../../modules/users/domain/user-role.js';

export interface AuthenticatedPrincipal {
  userId: string;
  role: UserRole;
  mustChangePassword: boolean;
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
    }
  }
}

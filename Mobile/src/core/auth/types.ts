export type UserRole = 'ADMIN' | 'TRAINER' | 'LEARNER';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  profile: { firstName?: string; lastName?: string };
  createdAt: string;
  updatedAt: string;
}

export interface MobileAuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterLearnerInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

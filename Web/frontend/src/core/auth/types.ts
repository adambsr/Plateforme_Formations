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

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface PaginatedUsers {
  items: User[];
  page: number;
  pageSize: number;
  total: number;
}

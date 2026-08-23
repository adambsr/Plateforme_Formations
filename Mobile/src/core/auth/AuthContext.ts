import { createContext, useContext } from 'react';

import type { RegisterLearnerInput, User } from './types';

export type AuthStatus = 'loading' | 'guest' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login(email: string, password: string): Promise<User>;
  register(input: RegisterLearnerInput): Promise<User>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<User>;
  updateProfile(firstName: string, lastName: string): Promise<User>;
  request<T>(path: string, options?: RequestInit): Promise<T>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth doit être utilisé dans AuthProvider.');
  }
  return value;
}

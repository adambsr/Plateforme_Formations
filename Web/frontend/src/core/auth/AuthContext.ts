import { createContext, useContext } from 'react';

import type { User } from './types.js';

export type AuthStatus = 'loading' | 'guest' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login(email: string, password: string): Promise<User>;
  register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<User>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<User>;
  updateProfile(firstName: string, lastName: string): Promise<User>;
  request<T>(path: string, options?: RequestInit): Promise<T>;
  download(path: string): Promise<Blob>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}

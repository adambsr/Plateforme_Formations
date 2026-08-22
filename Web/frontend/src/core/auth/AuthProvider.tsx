import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, apiDownload, apiRequest } from '../api/client.js';
import type { AuthSession, User } from './types.js';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './AuthContext.js';
let sharedRefresh: Promise<AuthSession> | null = null;

function refreshWebSession(): Promise<AuthSession> {
  sharedRefresh ??= apiRequest<AuthSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ client: 'WEB' }),
  }).finally(() => {
    sharedRefresh = null;
  });
  return sharedRefresh;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const accessToken = useRef<string | null>(null);

  const acceptSession = useCallback((session: AuthSession) => {
    accessToken.current = session.accessToken;
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const becomeGuest = useCallback(() => {
    accessToken.current = null;
    setUser(null);
    setStatus('guest');
  }, []);

  useEffect(() => {
    let active = true;
    void refreshWebSession()
      .then((session) => {
        if (active) acceptSession(session);
      })
      .catch(() => {
        if (active) becomeGuest();
      });
    return () => {
      active = false;
    };
  }, [acceptSession, becomeGuest]);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiRequest<T>(
          path,
          options,
          accessToken.current ?? undefined,
        );
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        try {
          const session = await refreshWebSession();
          acceptSession(session);
          return await apiRequest<T>(path, options, session.accessToken);
        } catch (refreshError) {
          becomeGuest();
          throw refreshError;
        }
      }
    },
    [acceptSession, becomeGuest],
  );

  const download = useCallback(
    async (path: string): Promise<Blob> => {
      try {
        return await apiDownload(path, {}, accessToken.current ?? undefined);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        try {
          const session = await refreshWebSession();
          acceptSession(session);
          return await apiDownload(path, {}, session.accessToken);
        } catch (refreshError) {
          becomeGuest();
          throw refreshError;
        }
      }
    },
    [acceptSession, becomeGuest],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(email, password) {
        return acceptSession(
          await apiRequest<AuthSession>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, client: 'WEB' }),
          }),
        );
      },
      async register(input) {
        return acceptSession(
          await apiRequest<AuthSession>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ ...input, client: 'WEB' }),
          }),
        );
      },
      async logout() {
        try {
          await apiRequest('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ client: 'WEB' }),
          });
        } finally {
          becomeGuest();
        }
      },
      async changePassword(currentPassword, newPassword) {
        return acceptSession(
          await request<AuthSession>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
              currentPassword,
              newPassword,
              client: 'WEB',
            }),
          }),
        );
      },
      async updateProfile(firstName, lastName) {
        const updated = await request<User>('/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ firstName, lastName }),
        });
        setUser(updated);
        return updated;
      },
      request,
      download,
    }),
    [acceptSession, becomeGuest, download, request, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

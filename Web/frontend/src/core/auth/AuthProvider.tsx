import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

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
  const navigate = useNavigate();
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
      .catch((error: unknown) => {
        if (!active) return;
        becomeGuest();
        if (error instanceof ApiError && error.code === 'ACCOUNT_UNAVAILABLE') {
          navigate('/status/account-unavailable', { replace: true });
        } else if (
          error instanceof ApiError &&
          (error.code === 'REFRESH_TOKEN_EXPIRED' ||
            error.code === 'REFRESH_TOKEN_REUSED')
        ) {
          navigate('/status/session-expired', { replace: true });
        }
      });
    return () => {
      active = false;
    };
  }, [acceptSession, becomeGuest, navigate]);

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
          navigate(
            refreshError instanceof ApiError &&
              refreshError.code === 'ACCOUNT_UNAVAILABLE'
              ? '/status/account-unavailable'
              : '/status/session-expired',
            { replace: true },
          );
          throw refreshError;
        }
      }
    },
    [acceptSession, becomeGuest, navigate],
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
          navigate(
            refreshError instanceof ApiError &&
              refreshError.code === 'ACCOUNT_UNAVAILABLE'
              ? '/status/account-unavailable'
              : '/status/session-expired',
            { replace: true },
          );
          throw refreshError;
        }
      }
    },
    [acceptSession, becomeGuest, navigate],
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
        const { email, password, firstName, lastName } = input;
        return acceptSession(
          await apiRequest<AuthSession>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              email,
              password,
              firstName,
              lastName,
              client: 'WEB',
            }),
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
          navigate('/', { replace: true });
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
    [acceptSession, becomeGuest, download, navigate, request, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

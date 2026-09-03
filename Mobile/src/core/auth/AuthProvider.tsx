import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { ApiError, apiClient } from '../api/client';
import { appConfig } from '../config/environment';
import { secureRefreshTokenStore } from '../storage/refresh-token-store';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './AuthContext';
import type { MobileAuthSession, User } from './types';
import { refreshMobileSession } from './mobile-session';
import { unregisterPushDevice } from '../notifications/firebase-messaging';

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const accessToken = useRef<string | null>(null);
  const refreshInFlight = useRef<Promise<MobileAuthSession> | null>(null);

  const applySession = useCallback((session: MobileAuthSession) => {
    accessToken.current = session.accessToken;
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const acceptSession = useCallback(
    async (session: MobileAuthSession) => {
      await secureRefreshTokenStore.set(session.refreshToken);
      return applySession(session);
    },
    [applySession],
  );

  const becomeGuest = useCallback(async () => {
    accessToken.current = null;
    setUser(null);
    try {
      await secureRefreshTokenStore.clear();
    } finally {
      setStatus('guest');
    }
  }, []);

  const refreshSession = useCallback((): Promise<MobileAuthSession> => {
    if (refreshInFlight.current !== null) return refreshInFlight.current;
    refreshInFlight.current = refreshMobileSession(
      apiClient,
      secureRefreshTokenStore,
    )
      .then((session) => {
        applySession(session);
        return session;
      })
      .finally(() => {
        refreshInFlight.current = null;
      });
    return refreshInFlight.current;
  }, [applySession]);

  useEffect(() => {
    let active = true;
    void refreshSession().catch(async () => {
      if (active) await becomeGuest();
    });
    return () => {
      active = false;
    };
  }, [becomeGuest, refreshSession]);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiClient.request<T>(
          path,
          options,
          accessToken.current ?? undefined,
        );
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        try {
          const session = await refreshSession();
          return await apiClient.request<T>(path, options, session.accessToken);
        } catch (refreshError) {
          await becomeGuest();
          throw refreshError;
        }
      }
    },
    [becomeGuest, refreshSession],
  );

  const download = useCallback(
    async (path: string, fileName: string): Promise<string> => {
      const directory = FileSystem.cacheDirectory;
      if (directory === null) {
        throw new ApiError(
          0,
          'FILE_CACHE_UNAVAILABLE',
          'Le stockage temporaire est indisponible.',
        );
      }
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destination = `${directory}${Date.now()}-${safeName}`;
      const perform = async (token: string) =>
        FileSystem.downloadAsync(
          `${appConfig.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`,
          destination,
          { headers: { authorization: `Bearer ${token}` } },
        );
      let token = accessToken.current;
      if (token === null) token = (await refreshSession()).accessToken;
      let result = await perform(token);
      if (result.status === 401) {
        const session = await refreshSession();
        result = await perform(session.accessToken);
      }
      if (result.status < 200 || result.status >= 300) {
        throw new ApiError(
          result.status,
          'FILE_DOWNLOAD_FAILED',
          'Le téléchargement a échoué.',
        );
      }
      return result.uri;
    },
    [refreshSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(email, password) {
        return acceptSession(
          await apiClient.request<MobileAuthSession>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              email: email.trim().toLowerCase(),
              password,
              client: 'MOBILE',
            }),
          }),
        );
      },
      async register(input) {
        return acceptSession(
          await apiClient.request<MobileAuthSession>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
              ...input,
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              email: input.email.trim().toLowerCase(),
              client: 'MOBILE',
            }),
          }),
        );
      },
      async logout() {
        try {
          await unregisterPushDevice(request).catch(() => undefined);
          const refreshToken = await secureRefreshTokenStore.get();
          if (refreshToken !== null) {
            await apiClient.request('/auth/logout', {
              method: 'POST',
              body: JSON.stringify({ client: 'MOBILE', refreshToken }),
            });
          }
        } finally {
          await becomeGuest();
        }
      },
      async changePassword(currentPassword, newPassword) {
        return acceptSession(
          await request<MobileAuthSession>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
              currentPassword,
              newPassword,
              client: 'MOBILE',
            }),
          }),
        );
      },
      async updateProfile(firstName, lastName) {
        const updated = await request<User>('/auth/me', {
          method: 'PUT',
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  ApiError,
  apiDownload,
  apiEventStream,
  apiRequest,
  type ApiStreamEvent,
} from '../api/client.js';
import type { AuthSession, User } from './types.js';
import {
  AuthContext,
  type AuthContextValue,
  type AuthStatus,
} from './AuthContext.js';
let sharedRefresh: Promise<AuthSession> | null = null;

function sessionFailurePath(error: unknown): string {
  if (error instanceof ApiError && error.code === 'ACCOUNT_UNAVAILABLE') {
    return '/status/account-unavailable';
  }
  if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
    return '/status/rate-limited';
  }
  return '/status/session-expired';
}

function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'RATE_LIMITED';
}

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
        if (isRateLimited(error)) {
          // Navigate before changing the initial loading state. Otherwise the
          // protected-route guard can replace this status route with 401.
          navigate('/status/rate-limited', { replace: true });
          window.setTimeout(becomeGuest, 0);
          return;
        }
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
          if (isRateLimited(refreshError)) {
            navigate('/status/rate-limited', { replace: true });
            throw refreshError;
          }
          becomeGuest();
          navigate(sessionFailurePath(refreshError), { replace: true });
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
          if (isRateLimited(refreshError)) {
            navigate('/status/rate-limited', { replace: true });
            throw refreshError;
          }
          becomeGuest();
          navigate(sessionFailurePath(refreshError), { replace: true });
          throw refreshError;
        }
      }
    },
    [acceptSession, becomeGuest, navigate],
  );

  const subscribe = useCallback(
    <T,>(
      path: string,
      onEvent: (event: ApiStreamEvent<T>) => void,
    ): (() => void) => {
      let active = true;
      let controller: AbortController | undefined;
      let reconnectTimer: number | undefined;
      let reconnectDelay = 1_000;

      const connect = async (): Promise<void> => {
        controller = new AbortController();
        try {
          await apiEventStream(
            path,
            controller.signal,
            onEvent,
            accessToken.current ?? undefined,
          );
          reconnectDelay = 1_000;
        } catch (error) {
          if (!active || controller.signal.aborted) return;
          if (error instanceof ApiError && error.status === 401) {
            try {
              acceptSession(await refreshWebSession());
              reconnectDelay = 1_000;
            } catch (refreshError) {
              if (isRateLimited(refreshError)) {
                navigate('/status/rate-limited', { replace: true });
                return;
              }
              becomeGuest();
              navigate(sessionFailurePath(refreshError), { replace: true });
              return;
            }
          }
        }
        if (!active) return;
        reconnectTimer = window.setTimeout(() => {
          void connect();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      };

      void connect();
      return () => {
        active = false;
        controller?.abort();
        if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      };
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
        // Keep protected guards neutral while the server revokes the refresh
        // session, so logout can never flash the authentication error route.
        setStatus('logging-out');
        accessToken.current = null;
        try {
          await apiRequest('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ client: 'WEB' }),
          });
        } finally {
          navigate('/', { replace: true });
          // React batches state and router updates. Yield one task so the home
          // route commits before the authenticated principal is cleared.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
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
      subscribe,
    }),
    [
      acceptSession,
      becomeGuest,
      download,
      navigate,
      request,
      status,
      subscribe,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
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

const AUTH_HINT_KEY = 'hsa-auth-state';

class SessionRefreshSupersededError extends Error {
  constructor() {
    super('A newer authentication action superseded this session refresh.');
    this.name = 'SessionRefreshSupersededError';
  }
}

function shouldSkipInitialRefresh(): boolean {
  try {
    return window.localStorage.getItem(AUTH_HINT_KEY) !== 'active';
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [signedOutAtStartup] = useState(shouldSkipInitialRefresh);
  const [status, setStatus] = useState<AuthStatus>(() =>
    signedOutAtStartup ? 'guest' : 'loading',
  );
  const [user, setUser] = useState<User | null>(null);
  const accessToken = useRef<string | null>(null);
  const authStatus = useRef<AuthStatus>(status);
  const refreshAllowed = useRef(!signedOutAtStartup);
  const refreshPromise = useRef<Promise<AuthSession> | null>(null);
  const sessionGeneration = useRef(0);

  const setAuthHint = useCallback((value: 'active' | 'signed-out') => {
    try {
      window.localStorage.setItem(AUTH_HINT_KEY, value);
    } catch {
      // HttpOnly cookies remain the source of truth when storage is unavailable.
    }
  }, []);

  const acceptSession = useCallback((session: AuthSession) => {
    refreshAllowed.current = true;
    accessToken.current = session.accessToken;
    authStatus.current = 'authenticated';
    setAuthHint('active');
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, [setAuthHint]);

  const becomeGuest = useCallback(() => {
    accessToken.current = null;
    authStatus.current = 'guest';
    setUser(null);
    setStatus('guest');
  }, []);

  const refreshWebSession = useCallback(async (): Promise<AuthSession> => {
    if (!refreshAllowed.current) throw new Error('Session refresh is disabled.');
    const generation = sessionGeneration.current;
    const pending =
      refreshPromise.current ??
      apiRequest<AuthSession>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ client: 'WEB' }),
      });
    refreshPromise.current = pending;
    try {
      const session = await pending;
      if (
        !refreshAllowed.current ||
        generation !== sessionGeneration.current
      ) {
        throw new SessionRefreshSupersededError();
      }
      return session;
    } catch (error) {
      if (generation !== sessionGeneration.current)
        throw new SessionRefreshSupersededError();
      refreshAllowed.current = false;
      throw error;
    } finally {
      if (refreshPromise.current === pending) refreshPromise.current = null;
    }
  }, []);

  const handleRefreshFailure = useCallback(
    (error: unknown) => {
      if (error instanceof SessionRefreshSupersededError) return;
      const redirectAsGuest = (
        path: string,
        state?: Record<string, string>,
      ) => {
        accessToken.current = null;
        authStatus.current = 'loading';
        flushSync(() => setStatus('loading'));
        navigate(path, { replace: true, state });
        window.setTimeout(becomeGuest, 100);
      };
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        const from = `${window.location.pathname}${window.location.search}`;
        redirectAsGuest('/status/rate-limited', { from });
        return;
      }
      if (error instanceof ApiError && error.code === 'ACCOUNT_UNAVAILABLE') {
        setAuthHint('signed-out');
        redirectAsGuest('/status/account-unavailable');
      } else if (
        error instanceof ApiError &&
        (error.code === 'REFRESH_TOKEN_EXPIRED' ||
          error.code === 'REFRESH_TOKEN_REUSED')
      ) {
        setAuthHint('signed-out');
        redirectAsGuest('/status/session-expired');
      } else if (
        error instanceof ApiError &&
        error.code === 'INVALID_REFRESH_TOKEN'
      ) {
        setAuthHint('signed-out');
        becomeGuest();
      } else {
        becomeGuest();
      }
    },
    [becomeGuest, navigate, setAuthHint],
  );

  useEffect(() => {
    if (signedOutAtStartup) return;
    let active = true;
    void refreshWebSession()
      .then((session) => {
        if (active) acceptSession(session);
      })
      .catch((error: unknown) => {
        if (!active || authStatus.current === 'authenticated') return;
        handleRefreshFailure(error);
      });
    return () => {
      active = false;
    };
  }, [acceptSession, handleRefreshFailure, refreshWebSession, signedOutAtStartup]);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      try {
        return await apiRequest<T>(
          path,
          options,
          accessToken.current ?? undefined,
        );
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          error.status !== 401 ||
          authStatus.current !== 'authenticated' ||
          !refreshAllowed.current
        )
          throw error;
        try {
          const session = await refreshWebSession();
          acceptSession(session);
          return await apiRequest<T>(path, options, session.accessToken);
        } catch (refreshError) {
          handleRefreshFailure(refreshError);
          throw refreshError;
        }
      }
    },
    [acceptSession, handleRefreshFailure, refreshWebSession],
  );

  const download = useCallback(
    async (path: string): Promise<Blob> => {
      try {
        return await apiDownload(path, {}, accessToken.current ?? undefined);
      } catch (error) {
        if (
          !(error instanceof ApiError) ||
          error.status !== 401 ||
          authStatus.current !== 'authenticated' ||
          !refreshAllowed.current
        )
          throw error;
        try {
          const session = await refreshWebSession();
          acceptSession(session);
          return await apiDownload(path, {}, session.accessToken);
        } catch (refreshError) {
          handleRefreshFailure(refreshError);
          throw refreshError;
        }
      }
    },
    [acceptSession, handleRefreshFailure, refreshWebSession],
  );

  const subscribe = useCallback(
    <T,>(path: string, onEvent: (event: ApiStreamEvent<T>) => void) => {
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
              handleRefreshFailure(refreshError);
              return;
            }
          }
        }
        if (!active) return;
        reconnectTimer = window.setTimeout(() => void connect(), reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
      };
      void connect();
      return () => {
        active = false;
        controller?.abort();
        if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      };
    },
    [acceptSession, handleRefreshFailure, refreshWebSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(email, password) {
        refreshAllowed.current = true;
        sessionGeneration.current += 1;
        return acceptSession(
          await apiRequest<AuthSession>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, client: 'WEB' }),
          }),
        );
      },
      async register(input) {
        refreshAllowed.current = true;
        sessionGeneration.current += 1;
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
        refreshAllowed.current = false;
        sessionGeneration.current += 1;
        setAuthHint('signed-out');
        authStatus.current = 'logging-out';
        flushSync(() => setStatus('logging-out'));
        const token = accessToken.current ?? undefined;
        try {
          await apiRequest('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ client: 'WEB' }),
          }, token);
        } finally {
          navigate('/', { replace: true });
          await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
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
      setAuthHint,
      status,
      subscribe,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

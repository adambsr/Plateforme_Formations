import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from './AuthContext.js';
import { AuthProvider } from './AuthProvider.js';

const user = {
  id: 'learner-1',
  email: 'learner@example.test',
  role: 'LEARNER' as const,
  isActive: true,
  mustChangePassword: false,
  profile: { firstName: 'Lina' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function url(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function Probe() {
  const { status, login, logout, request } = useAuth();
  const location = useLocation();
  const [result, setResult] = useState('');
  if (status === 'loading') return <p>Chargement</p>;
  return (
    <>
      <output>{location.pathname}</output>
      <button
        onClick={() => {
          void logout().then(async () => {
            try {
              await request('/protected');
            } catch {
              setResult('signed-out');
            }
          });
        }}
      >
        Déconnexion
      </button>
      <button
        onClick={() => {
          void Promise.all([request('/protected'), request('/protected')]).then(
            () => setResult('refreshed'),
          );
        }}
      >
        Requêtes parallèles
      </button>
      <button
        onClick={() => {
          void request('/protected').catch(() => undefined);
        }}
      >
        Expire request
      </button>
      <button
        onClick={() => {
          void login('learner@example.test', 'password-valid').then(() =>
            setResult('reconnected'),
          );
        }}
      >
        Reconnect
      </button>
      <span>{result}</span>
    </>
  );
}

function renderProbe() {
  window.localStorage.setItem('hsa-auth-state', 'active');
  return render(
    <MemoryRouter initialEntries={['/app/learner']}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('AuthProvider refresh lifecycle', () => {
  it('routes a throttled refresh to the recoverable rate-limit page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          json(
            {
              error: {
                code: 'RATE_LIMITED',
                message: 'Too many requests.',
              },
            },
            429,
          ),
        ),
      ),
    );
    renderProbe();

    expect(
      await screen.findByText('/status/rate-limited'),
    ).toBeVisible();
    expect(window.localStorage.getItem('hsa-auth-state')).toBe('active');
  });

  it('deduplicates refreshes when protected requests fail together', async () => {
    let refreshes = 0;
    let protectedCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = url(input);
      if (requestUrl.endsWith('/auth/refresh')) {
        refreshes += 1;
        return Promise.resolve(
          json({ accessToken: `token-${refreshes}`, user }),
        );
      }
      if (requestUrl.endsWith('/protected')) {
        protectedCalls += 1;
        return Promise.resolve(
          protectedCalls <= 2
            ? json({ error: { code: 'UNAUTHORIZED', message: 'Expired.' } }, 401)
            : json({ ok: true }),
        );
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();

    fireEvent.click(await screen.findByRole('button', { name: 'Requêtes parallèles' }));
    expect(await screen.findByText('refreshed')).toBeVisible();
    expect(refreshes).toBe(2);
  });

  it('ignores a refresh failure superseded by a successful login', async () => {
    let refreshes = 0;
    let resolveLateRefresh: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = url(input);
      if (requestUrl.endsWith('/auth/refresh')) {
        refreshes += 1;
        if (refreshes === 1)
          return Promise.resolve(json({ accessToken: 'token-1', user }));
        return new Promise<Response>((resolve) => {
          resolveLateRefresh = resolve;
        });
      }
      if (requestUrl.endsWith('/protected')) {
        return Promise.resolve(
          json({ error: { code: 'UNAUTHORIZED', message: 'Expired.' } }, 401),
        );
      }
      if (requestUrl.endsWith('/auth/login')) {
        return Promise.resolve(json({ accessToken: 'token-login', user }));
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();

    fireEvent.click(await screen.findByRole('button', { name: 'Expire request' }));
    await waitFor(() => expect(resolveLateRefresh).toBeTypeOf('function'));
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(await screen.findByText('reconnected')).toBeVisible();
    resolveLateRefresh?.(
      json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } },
        429,
      ),
    );

    await waitFor(() =>
      expect(screen.getByText('/app/learner')).toBeVisible(),
    );
  });

  it('lands on home and suppresses refresh after logout', async () => {
    let refreshes = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const requestUrl = url(input);
      if (requestUrl.endsWith('/auth/refresh')) {
        refreshes += 1;
        return Promise.resolve(json({ accessToken: 'token-1', user }));
      }
      if (requestUrl.endsWith('/auth/logout')) {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (requestUrl.endsWith('/protected')) {
        return Promise.resolve(
          json({ error: { code: 'UNAUTHORIZED', message: 'Signed out.' } }, 401),
        );
      }
      throw new Error(`Unexpected request: ${requestUrl}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    renderProbe();

    fireEvent.click(await screen.findByRole('button', { name: 'Déconnexion' }));
    await waitFor(() => expect(screen.getByText('/')).toBeVisible());
    expect(await screen.findByText('signed-out')).toBeVisible();
    expect(refreshes).toBe(1);
    expect(window.localStorage.getItem('hsa-auth-state')).toBe('signed-out');
  });
});

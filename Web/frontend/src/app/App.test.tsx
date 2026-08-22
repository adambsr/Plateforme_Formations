import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '../core/auth/AuthProvider.js';
import { App } from './App.js';

function renderAt(path: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'INVALID_REFRESH_TOKEN', message: 'No session.' },
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
    ),
  );

  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
}

function renderAppAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Phase 1 Web routes', () => {
  it('restores the Web session before rendering the login page', async () => {
    renderAt('/login');

    expect(
      await screen.findByRole('heading', { name: 'Bienvenue' }),
    ).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('offers learner-only public registration without a role selector', async () => {
    renderAt('/register');

    expect(
      await screen.findByRole('heading', { name: /compte Apprenant/i }),
    ).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('Phase 2 management routes', () => {
  it('loads the Admin training and category workspace', async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(
          jsonResponse({
            accessToken: 'admin-access-token',
            user: {
              id: 'admin-1',
              email: 'admin@example.test',
              role: 'ADMIN',
              isActive: true,
              mustChangePassword: false,
              profile: { firstName: 'Admin' },
              createdAt: '2026-08-21T10:00:00.000Z',
              updatedAt: '2026-08-21T10:00:00.000Z',
            },
          }),
        );
      }
      if (url.includes('/categories?includeArchived=true')) {
        return Promise.resolve(jsonResponse([]));
      }
      if (url.includes('/trainings?view=MANAGED')) {
        return Promise.resolve(
          jsonResponse({ items: [], page: 1, pageSize: 100, total: 0 }),
        );
      }
      if (url.includes('/trainers?pageSize=100')) {
        return Promise.resolve(
          jsonResponse({ items: [], page: 1, pageSize: 100, total: 0 }),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderAppAt('/app/trainings');

    expect(
      await screen.findByRole('heading', { name: 'Créer une formation' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Catégories' })).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Aucune formation gérée' }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/trainings?view=MANAGED&page=1&pageSize=12'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('keeps Learners out of the owner management route', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          accessToken: 'learner-access-token',
          user: {
            id: 'learner-1',
            email: 'learner@example.test',
            role: 'LEARNER',
            isActive: true,
            mustChangePassword: false,
            profile: { firstName: 'Lina' },
            createdAt: '2026-08-21T10:00:00.000Z',
            updatedAt: '2026-08-21T10:00:00.000Z',
          },
        }),
      ),
    );

    renderAppAt('/app/trainings');

    expect(
      await screen.findByRole('heading', { name: 'Bonjour Lina' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /formations/i }),
    ).not.toBeInTheDocument();
  });
});

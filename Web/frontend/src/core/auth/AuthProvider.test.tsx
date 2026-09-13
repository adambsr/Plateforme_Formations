import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireAuthentication } from '../../app/routes/guards.js';
import { AuthProvider } from './AuthProvider.js';
import { useAuth } from './AuthContext.js';
import type { UserRole } from './types.js';

function ProtectedPage() {
  const { logout } = useAuth();
  return <button onClick={() => void logout()}>Déconnexion</button>;
}

function Locations({ values }: { values: string[] }) {
  const location = useLocation();
  if (values.at(-1) !== location.pathname) values.push(location.pathname);
  return <Outlet />;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('authenticated logout', () => {
  it.each<UserRole>(['LEARNER', 'TRAINER', 'ADMIN'])(
    'clears the %s session and redirects directly home',
    async (role) => {
      const locations: string[] = [];
      const fetchMock = vi
        .fn()
        .mockImplementation((input: RequestInfo | URL) => {
          const url = typeof input === 'string' ? input : input.toString();
          if (url.endsWith('/auth/refresh')) {
            return Promise.resolve(
              new Response(
                JSON.stringify({
                  accessToken: `${role}-token`,
                  user: {
                    id: `${role}-1`,
                    email: `${role.toLowerCase()}@example.test`,
                    role,
                    isActive: true,
                    mustChangePassword: false,
                    profile: { firstName: role },
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                  },
                }),
                {
                  status: 200,
                  headers: { 'content-type': 'application/json' },
                },
              ),
            );
          }
          if (url.endsWith('/auth/logout'))
            return Promise.resolve(new Response(null, { status: 204 }));
          throw new Error(`Unexpected request: ${url}`);
        });
      vi.stubGlobal('fetch', fetchMock);
      render(
        <MemoryRouter initialEntries={['/app']}>
          <AuthProvider>
            <Routes>
              <Route element={<Locations values={locations} />}>
                <Route path="/" element={<h1>Accueil</h1>} />
                <Route element={<RequireAuthentication />}>
                  <Route path="/app" element={<ProtectedPage />} />
                </Route>
                <Route
                  path="/status/authentication-required"
                  element={<h1>Authentification requise</h1>}
                />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>,
      );
      fireEvent.click(
        await screen.findByRole('button', { name: 'Déconnexion' }),
      );
      expect(
        await screen.findByRole('heading', { name: 'Accueil' }),
      ).toBeVisible();
      expect(locations).toEqual(['/app', '/']);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/logout',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
    },
  );
});

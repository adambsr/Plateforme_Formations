import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleLayout } from './RoleLayout.js';

let role = 'LEARNER';
const logout = vi.fn();
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'test@example.test',
      role,
      profile: { firstName: 'Amina', lastName: 'Ben Ali' },
    },
    logout,
    subscribe: () => () => undefined,
    request: vi.fn(async (path: string) =>
      path.includes('unread-count')
        ? { unread: 0 }
        : { items: [], unread: 0, total: 0, page: 1, pageSize: 8 },
    ),
  }),
}));
function mount() {
  return render(
    <MemoryRouter initialEntries={['/app/learner']}>
      <Routes>
        <Route path="/app" element={<RoleLayout />}>
          <Route path="*" element={<h1>Contenu</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  role = 'LEARNER';
});

describe('Shared role navigation', () => {
  it.each(['LEARNER', 'TRAINER', 'ADMIN'])(
    'exposes only permitted links for %s',
    (currentRole) => {
      role = currentRole;
      mount();
      const nav = within(
        screen.getByRole('navigation', { name: 'Navigation principale' }),
      );
      expect(
        nav.getByRole('link', { name: 'Tableau de bord' }),
      ).toHaveAttribute(
        'href',
        currentRole === 'ADMIN'
          ? '/app/dashboard'
          : currentRole === 'TRAINER'
            ? '/app/trainer'
            : '/app/learner',
      );
      expect(Boolean(nav.queryByRole('link', { name: 'Utilisateurs' }))).toBe(
        currentRole === 'ADMIN',
      );
      expect(
        Boolean(
          nav.queryByRole('link', { name: /^(Mes formations|Formations)$/ }),
        ),
      ).toBe(currentRole !== 'LEARNER');
      expect(
        Boolean(nav.queryByRole('link', { name: /^(Paiements|Mes achats)$/ })),
      ).toBe(currentRole !== 'TRAINER');
      if (currentRole === 'TRAINER') {
        expect(
          nav.queryByRole('link', { name: 'Catalogue' }),
        ).not.toBeInTheDocument();
        expect(
          nav.queryByRole('link', { name: /Certificat/ }),
        ).not.toBeInTheDocument();
        expect(nav.getByRole('link', { name: 'Mes sessions' })).toHaveAttribute(
          'href',
          '/app/sessions',
        );
        expect(
          nav.getByRole('link', { name: 'Mes évaluations' }),
        ).toHaveAttribute('href', '/app/evaluations');
        expect(
          nav.getByRole('link', { name: 'Mes apprenants' }),
        ).toHaveAttribute('href', '/app/attendance');
      }
      if (currentRole === 'LEARNER') {
        expect(
          nav.getByRole('link', { name: 'Mes certifications' }),
        ).toHaveAttribute('href', '/app/certificates');
        expect(nav.getByRole('link', { name: 'Mes achats' })).toHaveAttribute(
          'href',
          '/app/payments',
        );
      }
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Réduire la barre latérale' }),
      );
      expect(
        nav.getByRole('link', { name: 'Tableau de bord' }),
      ).toHaveAccessibleName('Tableau de bord');
    },
  );

  it('opens the mobile drawer, isolates the page and restores focus after Escape', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    mount();
    const trigger = screen.getByRole('button', { name: 'Ouvrir le menu' });
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toHaveAttribute(
      'aria-modal',
      'true',
    );
    expect(document.querySelector('main')).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(document.querySelector('main')).not.toHaveAttribute('inert');
    expect(document.querySelector('#dashboard-navigation')).toHaveAttribute(
      'inert',
    );
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

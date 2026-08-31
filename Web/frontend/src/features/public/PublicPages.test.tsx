import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LandingPage } from './PublicPages.js';

let authenticatedUser: { id: string } | null = null;

vi.mock('../../core/api/client.js', () => ({
  apiRequest: vi
    .fn()
    .mockResolvedValue({ items: [], page: 1, pageSize: 3, total: 0 }),
}));
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ user: authenticatedUser }),
}));
afterEach(cleanup);
beforeEach(() => {
  authenticatedUser = null;
});

describe('Phase 12 public website', () => {
  it('presents a real value proposition and primary public journeys', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', {
        name: 'La formation qui avance avec vous.',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Explorer les formations' }),
    ).toHaveAttribute('href', '/catalogue');
    expect(
      screen.getAllByRole('link', { name: 'Créer mon compte' }),
    ).toHaveLength(2);
    expect(
      await screen.findByText('De nouveaux parcours arrivent bientôt.'),
    ).toBeVisible();
  });

  it('hides account creation calls to action for signed-in visitors', () => {
    authenticatedUser = { id: 'learner-1' };
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('link', { name: 'Créer mon compte' }),
    ).not.toBeInTheDocument();
  });
});

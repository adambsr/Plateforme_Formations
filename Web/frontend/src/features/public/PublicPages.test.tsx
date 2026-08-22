import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LandingPage } from './PublicPages.js';

vi.mock('../../core/api/client.js', () => ({
  apiRequest: vi
    .fn()
    .mockResolvedValue({ items: [], page: 1, pageSize: 3, total: 0 }),
}));
afterEach(cleanup);

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
});

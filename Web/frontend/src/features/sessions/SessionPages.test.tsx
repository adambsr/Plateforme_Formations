import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PublicTrainingSessions } from './SessionPages.js';
import { formatTunisDate, tunisInputToUtc } from './time.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Phase 4 Tunisia scheduling', () => {
  it('converts Africa/Tunis input to an explicit UTC instant', () => {
    expect(tunisInputToUtc('2026-01-15T09:30')).toBe(
      '2026-01-15T08:30:00.000Z',
    );
    expect(formatTunisDate('2026-01-15T08:30:00.000Z')).toMatch(/0?9:30/);
  });

  it('renders the public empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ items: [], page: 1, pageSize: 100, total: 0 }),
        ),
    );
    render(
      <MemoryRouter>
        <PublicTrainingSessions trainingId="training-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Chargement des sessions/i)).toBeVisible();
    expect(await screen.findByText(/Aucune session planifiée/i)).toBeVisible();
  });

  it('renders Session API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response(
          {
            error: {
              code: 'UNAVAILABLE',
              message: 'Calendrier indisponible.',
            },
          },
          503,
        ),
      ),
    );
    render(
      <MemoryRouter>
        <PublicTrainingSessions trainingId="training-1" />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Calendrier indisponible.',
    );
  });
});

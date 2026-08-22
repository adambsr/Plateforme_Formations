import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CataloguePage } from './TrainingPages.js';
import type { PaginatedTrainings, Training } from './types.js';

const publishedTraining: Training = {
  id: 'training-1',
  title: 'TypeScript strict en pratique',
  description: 'Construire des applications fiables avec TypeScript.',
  category: { id: 'category-1', name: 'Développement', isArchived: false },
  level: 'Intermédiaire',
  durationMinutes: 210,
  objectives: ['Modéliser un domaine'],
  prerequisites: ['JavaScript'],
  type: 'SELF_PACED_ONLINE',
  priceMinor: 12550,
  currency: 'TND',
  ownerTrainer: { id: 'trainer-1', firstName: 'Amina', lastName: 'Ben Ali' },
  status: 'PUBLISHED',
  createdAt: '2026-08-21T10:00:00.000Z',
  updatedAt: '2026-08-21T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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

function renderCatalogue() {
  return render(
    <MemoryRouter>
      <CataloguePage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Phase 2 public catalogue', () => {
  it('shows loading and then renders published server data', async () => {
    let resolveTrainings!: (response: Response) => void;
    const pendingTrainings = new Promise<Response>((resolve) => {
      resolveTrainings = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url.endsWith('/categories')) {
          return Promise.resolve(
            jsonResponse([
              {
                id: 'category-1',
                name: 'Développement',
                isArchived: false,
                createdAt: publishedTraining.createdAt,
                updatedAt: publishedTraining.updatedAt,
              },
            ]),
          );
        }
        return pendingTrainings;
      }),
    );

    renderCatalogue();
    expect(screen.getByText(/Chargement du catalogue/i)).toBeVisible();

    await act(async () => {
      const page: PaginatedTrainings = {
        items: [publishedTraining],
        page: 1,
        pageSize: 9,
        total: 1,
      };
      resolveTrainings(jsonResponse(page));
    });

    expect(
      await screen.findByRole('heading', {
        name: 'TypeScript strict en pratique',
      }),
    ).toBeVisible();
    expect(screen.getAllByText('Développement')).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'Voir la formation' }),
    ).toHaveAttribute('href', '/trainings/training-1');
  });

  it('renders the empty state returned by the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = requestUrl(input);
        return Promise.resolve(
          url.endsWith('/categories')
            ? jsonResponse([])
            : jsonResponse({ items: [], page: 1, pageSize: 9, total: 0 }),
        );
      }),
    );

    renderCatalogue();

    expect(
      await screen.findByRole('heading', { name: 'Aucune formation publiée' }),
    ).toBeVisible();
  });

  it('renders an actionable API error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(
            {
              error: {
                code: 'CATALOGUE_UNAVAILABLE',
                message: 'Catalogue indisponible.',
              },
            },
            503,
          ),
        ),
      ),
    );

    renderCatalogue();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Catalogue indisponible.',
    );
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });
});

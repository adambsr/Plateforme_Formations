import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnerDashboard, TrainerDashboard } from './RoleDashboards.js';
import {
  trackRecommendationClick,
  trackRecommendationImpressions,
} from '../../core/analytics/recommendation-analytics.js';

vi.mock('../../core/analytics/recommendation-analytics.js', () => ({
  trackRecommendationClick: vi.fn(),
  trackRecommendationImpressions: vi.fn(),
}));
let role = 'LEARNER';

const request = vi.fn();
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({
    request,
    user: {
      id: 'learner-1',
      email: 'amina@example.com',
      role,
      mustChangePassword: false,
      profile: { firstName: 'Amina' },
    },
  }),
}));

beforeEach(() => {
  request.mockReset();
  role = 'LEARNER';
  vi.mocked(trackRecommendationClick).mockClear();
  vi.mocked(trackRecommendationImpressions).mockClear();
  request.mockImplementation((path: string) => {
    if (path === '/dashboard/recommendations') {
      return Promise.resolve({
        strategy: 'HISTORY_AND_POPULARITY',
        recommendations: [
          {
            id: 'recommended-1',
            title: 'TypeScript avanc\u00e9',
            description: 'Approfondissez vos comp\u00e9tences TypeScript.',
            type: 'SELF_PACED_ONLINE',
            level: 'Avanc\u00e9',
            durationMinutes: 180,
            priceMinor: 9900,
            currency: 'EUR',
            categoryId: 'category-1',
            categoryName: 'D\u00e9veloppement',
            thumbnailUrl: '/trainings/recommended-1/thumbnail?v=42',
            reason: 'Dans la continuit\u00e9 de votre parcours.',
          },
        ],
      });
    }
    return Promise.resolve({ items: [], page: 1, pageSize: 5, total: 0 });
  });
});

afterEach(cleanup);

describe('Learner dashboard recommendations', () => {
  it('renders a recommendation with the same card link as the catalogue', async () => {
    render(
      <MemoryRouter>
        <LearnerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('TypeScript avanc\u00e9')).toBeVisible();
    expect(
      screen.getByText('Approfondissez vos comp\u00e9tences TypeScript.'),
    ).toBeVisible();
    const cardLink = screen.getByRole('link', {
      name: 'Voir la formation TypeScript avanc\u00e9',
    });
    expect(cardLink).toHaveClass('training-card-link');
    expect(cardLink.firstElementChild).toHaveClass('training-card');
    expect(cardLink).toHaveAttribute('href', '/trainings/recommended-1');
    expect(
      screen.getByAltText('Miniature de la formation TypeScript avanc\u00e9'),
    ).toHaveAttribute(
      'src',
      'http://localhost:3000/api/trainings/recommended-1/thumbnail?v=42',
    );
    expect(trackRecommendationImpressions).toHaveBeenCalledWith([
      { trainingId: 'recommended-1', categoryName: 'Développement', rank: 1 },
    ]);
    fireEvent.click(cardLink);
    expect(trackRecommendationClick).toHaveBeenCalledWith({
      trainingId: 'recommended-1',
      categoryName: 'Développement',
      rank: 1,
    });
  });

  it('calculates progress across every page and filters planned sessions at the API', async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation((path: string) => {
      if (path.startsWith('/progress'))
        return Promise.resolve({
          total: 101,
          items: path.includes('page=2&')
            ? [
                {
                  training: { title: 'Dernier parcours' },
                  percentage: 0,
                  isComplete: false,
                },
              ]
            : Array.from({ length: 100 }, (_, i) => ({
                training: { title: `Parcours ${i}` },
                percentage: 100,
                isComplete: true,
              })),
        });
      return original(path);
    });
    render(
      <MemoryRouter>
        <LearnerDashboard />
      </MemoryRouter>,
    );
    const metric = (
      await screen.findByRole('heading', { name: 'Progression moyenne' })
    ).closest('article')!;
    expect(within(metric).getByText('99%')).toBeVisible();
    expect(request).toHaveBeenCalledWith('/progress?page=2&pageSize=100');
    expect(request).toHaveBeenCalledWith(
      '/sessions?view=ENROLLED&status=PLANNED&page=1&pageSize=5',
    );
  });

  it('shows loading, then a recoverable error without fabricated zero metrics', async () => {
    let reject!: (error: Error) => void;
    request.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    render(
      <MemoryRouter>
        <LearnerDashboard />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement du tableau de bord',
    );
    reject(new Error('offline'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger',
    );
    expect(
      screen.queryByRole('heading', { name: 'Certificats' }),
    ).not.toBeInTheDocument();
    request.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/dashboard/recommendations'
          ? { strategy: 'HISTORY_AND_POPULARITY', recommendations: [] }
          : { items: [], total: 0 },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(
      await screen.findByText('Votre prochain parcours commence ici.'),
    ).toBeVisible();
    expect(screen.getByText(/Aucune nouvelle recommandation/)).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses managed trainer data and exposes sessions, participants and attendance', async () => {
    role = 'TRAINER';
    request.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/dashboard/trainer'
          ? {
              learnerCount: 12,
              activity: [
                {
                  id: 'activity-1',
                  type: 'ENROLLMENT',
                  title: 'Nouvelle inscription',
                  description: 'Amina Ben Ali · Power BI',
                  occurredAt: new Date().toISOString(),
                },
              ],
            }
          : path.startsWith('/sessions')
            ? {
                total: 1,
                items: [
                  {
                    id: 's1',
                    title: 'Atelier',
                    training: { title: 'Power BI' },
                    status: 'PLANNED',
                    startAt: '2026-10-01T10:00:00Z',
                    enrolledCount: 8,
                    location: 'Centre HSA',
                    room: 'Salle 2',
                  },
                ],
              }
            : { items: [], total: 0 },
      ),
    );
    render(
      <MemoryRouter>
        <TrainerDashboard />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Power BI')).toBeVisible();
    expect(screen.getByText('Nouvelle inscription')).toBeVisible();
    expect(screen.getByText('Amina Ben Ali · Power BI')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    const sessionsPanel = screen
      .getByRole('heading', { name: 'Mes sessions planifiées' })
      .closest<HTMLElement>('.content-card')!;
    expect(within(sessionsPanel).getByText('8')).toBeVisible();
    expect(screen.getByText(/Centre HSA · Salle 2/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Saisir les présences/ }),
    ).toHaveAttribute('href', '/app/attendance');
    expect(request).toHaveBeenCalledWith(
      '/sessions?view=MANAGED&status=PLANNED&page=1&pageSize=5',
    );
    expect(request).toHaveBeenCalledWith('/dashboard/trainer');
    expect(request).not.toHaveBeenCalledWith('/dashboard/recommendations');
  });
});

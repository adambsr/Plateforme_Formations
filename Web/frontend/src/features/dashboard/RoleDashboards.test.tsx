import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnerDashboard } from './RoleDashboards.js';

const request = vi.fn();
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({
    request,
    user: {
      id: 'learner-1',
      email: 'amina@example.com',
      role: 'LEARNER',
      mustChangePassword: false,
      profile: { firstName: 'Amina' },
    },
  }),
}));

beforeEach(() => {
  request.mockReset();
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
    expect(cardLink).toHaveAttribute(
      'href',
      '/trainings/recommended-1',
    );
  });
});

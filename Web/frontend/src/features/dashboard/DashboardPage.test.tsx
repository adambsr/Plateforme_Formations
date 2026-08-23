import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPage } from './DashboardPage.js';

const request = vi.fn();
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ request }),
}));

beforeEach(() => {
  request.mockReset();
  request.mockImplementation((path: string) => {
    const period = {
      from: '2026-08-01',
      to: '2026-08-31',
      timeZone: 'Africa/Tunis',
    };
    if (path.startsWith('/dashboard/overview'))
      return Promise.resolve({
        period,
        counts: {
          trainings: 1,
          sessions: 2,
          learners: 3,
          trainers: 4,
          enrollments: 5,
        },
      });
    if (path.startsWith('/dashboard/participation'))
      return Promise.resolve({
        period,
        overall: {
          expected: 10,
          recorded: 8,
          present: 7,
          participationPercent: 70,
        },
        byTraining: [],
      });
    if (path.startsWith('/dashboard/progress'))
      return Promise.resolve({
        period,
        selfPaced: {
          enrollmentCount: 2,
          completedEnrollments: 1,
          averagePercentage: 50,
        },
        evaluations: {
          totalAttempts: 2,
          passedAttempts: 1,
          failedAttempts: 1,
          passPercent: 50,
        },
      });
    if (path.startsWith('/dashboard/satisfaction'))
      return Promise.resolve({
        period,
        global: {
          count: 0,
          average: null,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
        byTraining: [],
      });
    if (path.startsWith('/dashboard/profitability'))
      return Promise.resolve({
        period,
        currency: 'EUR',
        includedTrainerMonths: [],
        revenueMinor: 0,
        trainerCostsMinor: 0,
        trainingCostsMinor: 0,
        totalCostsMinor: 0,
        resultMinor: 0,
        profitabilityPercent: null,
        byTraining: [
          {
            training: { id: 't1', title: 'TypeScript' },
            revenueMinor: 1000,
            trainingCostsMinor: 200,
            resultBeforeFixedTrainerCostsMinor: 800,
          },
        ],
      });
    return Promise.resolve({ items: [], page: 1, pageSize: 100, total: 0 });
  });
});
afterEach(cleanup);

describe('Phase 11 Admin dashboard UI', () => {
  it('renders backend aggregates, zero-revenue state, and both cost workflows', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('70%')).toBeVisible();
    expect(screen.getByText('Données insuffisantes')).toBeVisible();
    expect(
      screen.getByText('Résultat avant coûts fixes des formateurs'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Coût mensuel formateur' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Nouvelle dépense formation' }),
    ).toBeVisible();
  });

  it('shows a backend loading failure', async () => {
    request.mockRejectedValue(new Error('offline'));
    render(<DashboardPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur inattendue est survenue.',
    );
  });
});

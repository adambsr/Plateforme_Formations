import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

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
    if (path.startsWith('/dashboard/learning-insights'))
      return Promise.resolve({
        period,
        completionTrend: [{ month: '2026-08', completed: 2 }],
        inactivity: {
          thresholdDays: 30,
          total: 1,
          learners: [
            {
              learner: {
                id: 'learner-1',
                email: 'learner@example.com',
                firstName: 'Amina',
              },
              lastActivityAt: '2026-06-01T00:00:00.000Z',
              inactiveDays: 60,
              activeTrainingCount: 1,
              trainingTitles: ['TypeScript'],
            },
          ],
        },
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
    if (path.startsWith('/trainers'))
      return Promise.resolve({
        items: [
          {
            id: 'trainer-1',
            email: 'sami@example.com',
            profile: { firstName: 'Sami', lastName: 'Trabelsi' },
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
      });
    if (path.startsWith('/trainings?view=MANAGED'))
      return Promise.resolve({
        items: [
          {
            id: 't1',
            title: 'TypeScript',
            category: { id: 'c1', name: 'Développement' },
            type: 'SELF_PACED_ONLINE',
          },
        ],
        page: 1,
        pageSize: 100,
        total: 1,
      });
    if (path.startsWith('/costs/trainers'))
      return Promise.resolve({
        items: [
          {
            id: 'tc1',
            trainer: {
              id: 'trainer-1',
              email: 'sami@example.com',
              firstName: 'Sami',
              lastName: 'Trabelsi',
            },
            year: 2026,
            month: 8,
            amountMinor: 120000,
            currency: 'EUR',
            note: 'Forfait',
          },
        ],
        page: 1,
        pageSize: 8,
        total: 1,
      });
    if (path.startsWith('/costs/trainings'))
      return Promise.resolve({
        items: [
          {
            id: 'cost-1',
            training: { id: 't1', title: 'TypeScript' },
            date: '2026-08-10',
            amountMinor: 20000,
            currency: 'EUR',
            label: 'Salle',
          },
        ],
        page: 1,
        pageSize: 8,
        total: 1,
      });
    return Promise.resolve({ items: [], page: 1, pageSize: 100, total: 0 });
  });
});
afterEach(cleanup);

describe('Phase 11 Admin dashboard UI', () => {
  it('renders backend aggregates, zero-revenue state, and both cost workflows', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('70%')).toBeVisible();
    expect(screen.getByText('Données insuffisantes')).toBeVisible();
    expect(
      screen.getByText('Résultat avant coûts fixes des formateurs'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Coûts mensuels formateurs' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Dépenses formations' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Apprenants devenus inactifs'),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Du')).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/^\/dashboard\/overview\?from=1970-01-01/),
    );
    expect(
      within(
        screen.getByRole('region', { name: 'Coûts mensuels des formateurs' }),
      ).getByRole('columnheader', { name: 'Montant' }),
    ).toBeVisible();
    expect(
      within(
        screen.getByRole('region', { name: 'Dépenses des formations' }),
      ).getByRole('button', { name: 'Modifier la dépense Salle' }),
    ).toBeVisible();
    const table = screen.getByRole('region', {
      name: 'Résultats financiers par formation',
    });
    expect(
      within(table).getByRole('rowheader', { name: 'TypeScript' }),
    ).toBeVisible();
    expect(within(table).getByText(/8,00/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voir les paiements' }),
    ).toHaveAttribute('href', '/app/payments');
  });

  it('shows a backend loading failure', async () => {
    request.mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur inattendue est survenue.',
    );
  });

  it('keeps modality filters usable and explains an empty filtered result', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByRole('region', {
      name: 'Résultats financiers par formation',
    });
    fireEvent.change(screen.getByLabelText('Modalité'), {
      target: { value: 'IN_PERSON' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(
      screen.getByText('Aucune formation ne correspond aux filtres.'),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('Modalité'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(
      screen.getByRole('region', {
        name: 'Résultats financiers par formation',
      }),
    ).toBeVisible();
  });

  it('opens cost forms in modals and keeps create, update and delete actions', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    await screen.findByRole('button', { name: 'Ajouter un coût' });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un coût' }));
    let dialog = screen.getByRole('dialog', {
      name: 'Ajouter un coût formateur',
    });
    fireEvent.change(within(dialog).getByLabelText('Formateur'), {
      target: { value: 'trainer-1' },
    });
    fireEvent.change(within(dialog).getByLabelText('Montant EUR'), {
      target: { value: '1200' },
    });
    fireEvent.submit(
      within(dialog)
        .getByRole('button', { name: 'Enregistrer' })
        .closest('form')!,
    );
    expect(request).toHaveBeenCalledWith(
      expect.stringMatching(/^\/costs\/trainers\/trainer-1\/\d{4}\/\d{2}$/),
      expect.objectContaining({ method: 'PUT' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ajouter une dépense' }),
    );
    dialog = screen.getByRole('dialog', { name: 'Ajouter une dépense' });
    expect(within(dialog).getByLabelText('Formation')).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Modifier la dépense Salle' }),
    );
    dialog = screen.getByRole('dialog', { name: 'Modifier la dépense' });
    expect(within(dialog).getByDisplayValue('Salle')).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Supprimer la dépense Salle' }),
    );
    expect(request).toHaveBeenCalledWith('/costs/trainings/cost-1', {
      method: 'DELETE',
    });
  });
});

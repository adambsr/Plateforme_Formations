import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EvaluationPage } from './EvaluationPage.js';

const request = vi.fn();
let currentUser: { id: string; role: 'ADMIN' | 'TRAINER' | 'LEARNER' } | null;
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ user: currentUser, request }),
}));

beforeEach(() => {
  request.mockReset();
  currentUser = { id: 'trainer-1', role: 'TRAINER' };
});
afterEach(cleanup);

describe('Phase 8 and 9 Evaluation UI', () => {
  it('shows loading then the empty owner state while still allowing the first Evaluation', async () => {
    request.mockImplementation((path: string) => {
      if (path.startsWith('/trainings?'))
        return Promise.resolve({
          items: [{ id: 'training-1', title: 'TypeScript' }],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      return Promise.resolve({ items: [], page: 1, pageSize: 100, total: 0 });
    });
    render(
      <MemoryRouter>
        <EvaluationPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Chargement/i)).toBeVisible();
    expect(await screen.findByText(/Aucune évaluation/i)).toBeVisible();
    expect(screen.getByRole('option', { name: 'TypeScript' })).toBeVisible();
  });

  it('renders AI draft review controls and editable imported questions for the owner', async () => {
    request.mockImplementation((path: string) => {
      if (path.startsWith('/evaluations?'))
        return Promise.resolve({
          items: [
            {
              id: 'eval-1',
              training: { id: 'training-1', title: 'TypeScript' },
              title: 'Quiz',
              status: 'DRAFT',
              questionCount: 1,
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      if (path.startsWith('/trainings?'))
        return Promise.resolve({
          items: [{ id: 'training-1', title: 'TypeScript' }],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      return Promise.resolve({
        id: 'eval-1',
        training: { id: 'training-1', title: 'TypeScript' },
        ownerTrainerId: 'trainer-1',
        title: 'Quiz',
        instructions: '',
        status: 'DRAFT',
        passPercentage: 70,
        maxAttempts: 3,
        questionCount: 1,
        isCertifying: false,
        questions: [
          {
            id: 'q-1',
            order: 1,
            points: 1,
            prompt: 'Question générée',
            type: 'SINGLE_CHOICE',
            options: [
              { id: 'A', text: 'Réponse' },
              { id: 'B', text: 'Autre' },
            ],
            correctOptionIds: ['A'],
          },
        ],
      });
    });
    render(
      <MemoryRouter>
        <EvaluationPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('button', { name: /Générer avec Gemini/i }),
    ).toBeVisible();
    expect(screen.getByText(/Question générée/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publier' })).toBeVisible();
  });

  it('shows a published enrolled Evaluation and the Learner start action', async () => {
    currentUser = { id: 'learner-1', role: 'LEARNER' };
    request.mockImplementation((path: string) => {
      if (path.startsWith('/evaluations?'))
        return Promise.resolve({
          items: [
            {
              id: 'eval-1',
              training: { id: 'training-1', title: 'TypeScript' },
              title: 'Quiz',
              status: 'PUBLISHED',
              questionCount: 1,
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      if (path.startsWith('/enrollments?'))
        return Promise.resolve({
          items: [
            {
              id: 'enrollment-1',
              training: { id: 'training-1', title: 'TypeScript' },
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      return Promise.resolve({
        id: 'eval-1',
        training: { id: 'training-1', title: 'TypeScript' },
        ownerTrainerId: 'trainer-1',
        title: 'Quiz',
        instructions: '',
        status: 'PUBLISHED',
        passPercentage: 70,
        maxAttempts: 3,
        questionCount: 1,
        isCertifying: false,
        questions: [],
        attempts: [],
      });
    });
    render(
      <MemoryRouter>
        <EvaluationPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('button', { name: /Commencer une tentative/i }),
    ).toBeVisible();
  });
});

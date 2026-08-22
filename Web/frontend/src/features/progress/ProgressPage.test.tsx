import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../core/api/client.js';
import { ProgressPage } from './ProgressPage.js';

const request = vi.fn();

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ request }),
}));

beforeEach(() => request.mockReset());

describe('Phase 6 learner progress UI', () => {
  it('renders server-calculated percentage and Certificate lock state', async () => {
    request.mockResolvedValue({
      items: [
        {
          enrollmentId: 'enrollment-1',
          training: { id: 'training-1', title: 'TypeScript autonome' },
          completedLessonCount: 2,
          totalLessonCount: 2,
          percentage: 100,
          isComplete: true,
          lockedByCertificate: true,
          lessons: [],
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    });

    render(
      <MemoryRouter>
        <ProgressPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Chargement de votre progression/i)).toBeVisible();
    expect(await screen.findByText('TypeScript autonome')).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
    expect(screen.getByText(/verrouillée après émission/i)).toBeVisible();
  });

  it('handles empty and API-error states', async () => {
    request.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    const { unmount } = render(
      <MemoryRouter>
        <ProgressPage />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText(/Aucune formation self-paced/i),
    ).toBeVisible();
    unmount();

    request.mockRejectedValueOnce(
      new ApiError(503, 'UNAVAILABLE', 'Progression indisponible.'),
    );
    render(
      <MemoryRouter>
        <ProgressPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Progression indisponible.',
    );
  });
});

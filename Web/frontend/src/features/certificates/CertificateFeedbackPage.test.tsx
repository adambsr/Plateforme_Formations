import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CertificateFeedbackPage } from './CertificateFeedbackPage.js';

const request = vi.fn();
const download = vi.fn();
let currentUser: {
  id: string;
  role: 'ADMIN' | 'TRAINER' | 'LEARNER';
} | null;

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ user: currentUser, request, download }),
}));

beforeEach(() => {
  request.mockReset();
  download.mockReset();
  currentUser = { id: 'learner-1', role: 'LEARNER' };
});
afterEach(cleanup);

describe('Phase 10 Certificate and Feedback UI', () => {
  it('shows learner generation and five immutable rating choices', async () => {
    request.mockImplementation((path: string) => {
      if (path.startsWith('/certificates')) {
        return Promise.resolve({ items: [], page: 1, pageSize: 100, total: 0 });
      }
      if (path.startsWith('/enrollments')) {
        return Promise.resolve({
          items: [
            {
              id: 'enrollment-1',
              learner: { id: 'learner-1', email: 'learner@example.com' },
              training: { id: 'training-1', title: 'TypeScript' },
              payment: { id: 'payment-1', amountMinor: 1000, currency: 'TND' },
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 100,
          total: 1,
        });
      }
      return Promise.resolve({});
    });
    render(<CertificateFeedbackPage />);
    expect(
      await screen.findByRole('button', { name: 'Générer le certificat' }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: /Noter \d étoile/ }),
    ).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Noter 5 étoiles' }));
    expect(request).toHaveBeenCalledWith('/feedback', {
      method: 'POST',
      body: JSON.stringify({ enrollmentId: 'enrollment-1', rating: 5 }),
    });
    expect(await screen.findByText(/Merci, votre note/)).toBeVisible();
  });

  it('renders Admin global and per-Training satisfaction aggregates', async () => {
    currentUser = { id: 'admin-1', role: 'ADMIN' };
    request.mockImplementation((path: string) => {
      if (path === '/feedback') {
        return Promise.resolve({
          global: {
            count: 2,
            average: 4.5,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
          },
          byTraining: [
            {
              training: { id: 'training-1', title: 'TypeScript' },
              count: 2,
              average: 4.5,
              distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
            },
          ],
        });
      }
      return Promise.resolve({ items: [], page: 1, pageSize: 100, total: 0 });
    });
    render(<CertificateFeedbackPage />);
    expect(await screen.findByText('Satisfaction')).toBeVisible();
    expect(screen.getByText(/2 notes · moyenne/)).toBeVisible();
    expect(screen.getByText('TypeScript')).toBeVisible();
    expect(screen.getByText(/5★ 1/)).toBeVisible();
  });

  it('shows only relevant issued Certificates to a Trainer', async () => {
    currentUser = { id: 'trainer-1', role: 'TRAINER' };
    request.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    render(<CertificateFeedbackPage />);
    expect(await screen.findByText('Aucun certificat émis.')).toBeVisible();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('/certificates?page=1&pageSize=10');
  });
});

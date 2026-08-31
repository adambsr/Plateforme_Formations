import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { trackRecommendationEnrollment } from '../../core/analytics/recommendation-analytics.js';
import { CheckoutReturnPage, PaymentCenterPage } from './PaymentPages.js';

const request = vi.fn();
const download = vi.fn();

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: {
      id: 'learner-1',
      email: 'learner@example.com',
      role: 'LEARNER',
      isActive: true,
      mustChangePassword: false,
      profile: { firstName: 'Ali', lastName: 'Learner' },
      createdAt: '2026-08-21T00:00:00.000Z',
      updatedAt: '2026-08-21T00:00:00.000Z',
    },
    request,
    download,
  }),
}));
vi.mock('../../core/analytics/recommendation-analytics.js', () => ({
  trackRecommendationEnrollment: vi.fn(),
}));

beforeEach(() => {
  request.mockReset();
  download.mockReset();
  vi.mocked(trackRecommendationEnrollment).mockReset();
});

describe('Phase 5 webhook-confirmed Web state', () => {
  it('renders empty Payment, Enrollment, and Invoice states', async () => {
    request.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      total: 0,
    });
    render(
      <MemoryRouter>
        <PaymentCenterPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Chargement des données confirmées/i),
    ).toBeVisible();
    expect(
      await screen.findByText('Aucune tentative de paiement.'),
    ).toBeVisible();
    expect(
      screen.getByText('Aucune inscription confirmée par webhook.'),
    ).toBeVisible();
    expect(screen.getByText('Aucune facture émise.')).toBeVisible();
  });

  it('does not trust the redirect and shows backend-confirmed paid access', async () => {
    request.mockResolvedValue({
      id: 'payment-1',
      training: { id: 'training-1', title: 'Formation payée' },
      purchaseType: 'SELF_PACED_ONLINE',
      status: 'PAID',
      amountMinor: 12_550,
      currency: 'EUR',
      enrollmentId: 'enrollment-1',
      invoiceId: 'invoice-1',
      paidAt: '2026-08-21T10:00:00.000Z',
      createdAt: '2026-08-21T10:00:00.000Z',
      updatedAt: '2026-08-21T10:00:00.000Z',
    });
    render(
      <MemoryRouter initialEntries={['/payments/success?paymentId=payment-1']}>
        <CheckoutReturnPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Le retour Stripe ne donne aucun accès à lui seul/i),
    ).toBeVisible();
    expect(await screen.findByText('Payé')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Accéder à la formation' }),
    ).toHaveAttribute('href', '/app/content/training-1');
    expect(request).toHaveBeenCalledWith('/payments/payment-1');
    expect(trackRecommendationEnrollment).toHaveBeenCalledWith('training-1');
  });

  it('renders financial API errors', async () => {
    request.mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter>
        <PaymentCenterPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Une erreur inattendue est survenue.',
    );
  });
});

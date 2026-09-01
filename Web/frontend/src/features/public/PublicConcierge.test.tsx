import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../../core/api/client.js';
import { PublicConcierge } from './PublicConcierge.js';

vi.mock('../../core/api/client.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../../core/api/client.js')
  >();
  return { ...original, apiRequest: vi.fn() };
});

const requestMock = vi.mocked(apiRequest);

describe('PublicConcierge', () => {
  beforeEach(() => {
    requestMock.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('opens from the floating launcher and renders grounded public links', async () => {
    requestMock.mockResolvedValue({
      answer: 'Découvrez nos formations dans le catalogue.',
      grounded: true,
      sources: [
        { id: 'page:catalogue', title: 'Catalogue', href: '/catalogue' },
      ],
      actions: [{ label: 'Voir le catalogue', href: '/catalogue' }],
      suggestedQuestions: ['Comment créer un compte ?'],
    });
    render(
      <MemoryRouter>
        <PublicConcierge />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', { name: /ouvrir l’assistant HSA/i }),
    );
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Quelles formations proposez-vous ?',
      }),
    );

    await waitFor(() => expect(requestMock).toHaveBeenCalledOnce());
    expect(requestMock).toHaveBeenCalledWith(
      '/public/concierge/messages',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await screen.findByText(/Découvrez nos formations/i)).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Voir le catalogue' }),
    ).toHaveAttribute('href', '/catalogue');
  });
});

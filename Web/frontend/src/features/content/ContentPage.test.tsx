import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentPage } from './ContentPage.js';

const request = vi.fn();
const download = vi.fn();

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ request, download }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/app/content/training-1']}>
      <Routes>
        <Route path="/app/content/:trainingId" element={<ContentPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  request.mockReset();
  download.mockReset();
});

describe('Phase 3 authorized content UI', () => {
  it('renders learner-readable content without authoring controls', async () => {
    request.mockResolvedValue({
      trainingId: 'training-1',
      access: 'LEARNER_READ',
      modules: [
        {
          id: 'module-1',
          title: 'Fondamentaux',
          description: '',
          order: 1,
          isArchived: false,
          createdAt: '2026-08-21T00:00:00.000Z',
          updatedAt: '2026-08-21T00:00:00.000Z',
          lessons: [],
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('Fondamentaux')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Ajouter un module' }),
    ).not.toBeInTheDocument();
  });

  it('shows the complete authoring entry point to managers', async () => {
    request.mockResolvedValue({
      trainingId: 'training-1',
      access: 'MANAGE',
      modules: [],
    });

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Ajouter un module' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Aucun contenu disponible' }),
    ).toBeVisible();
  });
});

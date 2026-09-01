import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentPage } from './ContentPage.js';

const request = vi.fn();
const download = vi.fn();
let user: { role: 'LEARNER' } | undefined;

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ request, download, user }),
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
  user = undefined;
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

  it('lets an enrolled learner ask the grounded tutor and open its Lesson citation', async () => {
    user = { role: 'LEARNER' };
    request.mockImplementation((path: string) => {
      if (path === '/trainings/training-1/content')
        return Promise.resolve({
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
              lessons: [
                {
                  id: 'lesson-1',
                  title: 'Les composants',
                  description: '',
                  textContent: 'Contenu de la leçon',
                  instructions: '',
                  order: 1,
                  isArchived: false,
                  resources: [],
                  createdAt: '2026-08-21T00:00:00.000Z',
                  updatedAt: '2026-08-21T00:00:00.000Z',
                },
              ],
            },
          ],
        });
      if (path === '/progress?trainingId=training-1')
        return Promise.resolve({ items: [] });
      if (path === '/trainings/training-1/tutor/messages')
        return Promise.resolve({
          answer: 'Un composant représente une partie réutilisable.',
          grounded: true,
          citations: [
            {
              lessonId: 'lesson-1',
              lessonTitle: 'Les composants',
              moduleTitle: 'Fondamentaux',
              href: '/app/content/training-1#lesson-lesson-1',
            },
          ],
          followUpQuestions: [],
          metadata: {
            provider: 'TEST',
            model: 'test',
            retrievedLessonCount: 1,
            contextChars: 100,
          },
        });
      return Promise.reject(new Error(`Unexpected request: ${path}`));
    });

    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Expliquer simplement' }),
    );

    expect(
      await screen.findByText('Un composant représente une partie réutilisable.'),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Fondamentaux · Les composants' }),
    ).toHaveAttribute('href', '/app/content/training-1#lesson-lesson-1');
    expect(request).toHaveBeenCalledWith(
      '/trainings/training-1/tutor/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminUserListPage } from './AdminUserManagementPages.js';

const request = vi.fn((path: string) => {
  if (path.startsWith('/trainers')) {
    return Promise.resolve({
      items: [
        {
          id: 'trainer-1',
          email: 'trainer@example.com',
          role: 'TRAINER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Sami', lastName: 'Trabelsi' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });
  }
  if (path.startsWith('/learners')) {
    return Promise.resolve({
      items: [
        {
          id: 'learner-1',
          email: 'learner@example.com',
          role: 'LEARNER',
          isActive: true,
          mustChangePassword: false,
          profile: { firstName: 'Leïla', lastName: 'Ben Salah' },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });
  }
  return Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0 });
});

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ request }),
}));

afterEach(() => {
  cleanup();
  request.mockClear();
  vi.restoreAllMocks();
});

describe('Admin user management actions', () => {
  it('groups the edit and disable actions with Lucide icons', async () => {
    render(
      <MemoryRouter>
        <AdminUserListPage />
      </MemoryRouter>,
    );

    const edit = await screen.findByRole('link', { name: 'Modifier' });
    const disable = screen.getAllByRole('button', { name: 'Désactiver' })[0];
    expect(edit.parentElement).toBe(disable.parentElement);
    expect(edit.querySelector('svg.lucide-pencil')).not.toBeNull();
    expect(disable.querySelector('svg.lucide-user-round-x')).not.toBeNull();
  });

  it('lets an admin deactivate and delete a learner account', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MemoryRouter>
        <AdminUserListPage />
      </MemoryRouter>,
    );

    await screen.findByText('learner@example.com');
    fireEvent.click(screen.getAllByRole('button', { name: 'Désactiver' })[1]);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/users/learner-1/disable', {
        method: 'POST',
      }),
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Supprimer' })[1]);
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/users/learner-1', {
        method: 'DELETE',
      }),
    );
  });
});

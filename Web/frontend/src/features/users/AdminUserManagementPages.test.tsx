import { cleanup, render, screen } from '@testing-library/react';
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
  return Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0 });
});

vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({ request }),
}));

afterEach(() => {
  cleanup();
  request.mockClear();
});

describe('Admin user management actions', () => {
  it('groups the edit and disable actions with Lucide icons', async () => {
    render(
      <MemoryRouter>
        <AdminUserListPage />
      </MemoryRouter>,
    );

    const edit = await screen.findByRole('link', { name: 'Modifier' });
    const disable = screen.getByRole('button', { name: 'Désactiver' });
    expect(edit.parentElement).toBe(disable.parentElement);
    expect(edit.querySelector('svg.lucide-pencil')).not.toBeNull();
    expect(disable.querySelector('svg.lucide-user-round-x')).not.toBeNull();
  });
});

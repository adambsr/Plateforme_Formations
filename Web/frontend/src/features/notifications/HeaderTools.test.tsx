import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HeaderSearch } from './HeaderSearch.js';
import { NotificationBell } from './NotificationBell.js';

const request = vi.fn();
type StreamEvent = { type: string; data: unknown };
const subscribe = vi.fn<
  (path: string, listener: (event: StreamEvent) => void) => () => void
>(() => () => undefined);
let role = 'LEARNER';
vi.mock('../../core/auth/AuthContext.js', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      email: 'learner@example.test',
      role,
      profile: { firstName: 'Amina' },
    },
    request,
    subscribe,
  }),
}));

afterEach(() => {
  cleanup();
  request.mockReset();
  subscribe.mockClear();
  role = 'LEARNER';
});

describe('dashboard header tools', () => {
  it('debounces real search and renders grouped role-scoped results', async () => {
    request.mockResolvedValue({
      query: 'Power',
      groups: [
        {
          type: 'TRAINING',
          items: [
            {
              id: 't1',
              type: 'TRAINING',
              title: 'Power BI',
              subtitle: 'Formation en ligne',
              link: '/app/content/t1',
            },
          ],
        },
      ],
    });
    render(
      <MemoryRouter>
        <HeaderSearch />
      </MemoryRouter>,
    );
    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'P' } });
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Power' } });
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/search?q=Power&limit=5'),
    );
    expect(
      await screen.findByRole('link', { name: /Power BI/ }),
    ).toHaveAttribute('href', '/app/content/t1');
  });

  it('shows unread state and marks all loaded notifications as read', async () => {
    request.mockImplementation(async (path: string) => {
      if (path === '/notifications/unread-count') return { unread: 2 };
      if (path.startsWith('/notifications?page='))
        return {
          items: [
            {
              id: 'n1',
              type: 'PURCHASE_CONFIRMED',
              title: 'Formation achetée',
              message: 'Inscription confirmée.',
              timestamp: new Date().toISOString(),
              read: false,
              link: '/app/payments',
            },
          ],
          page: 1,
          pageSize: 8,
          total: 1,
          unread: 2,
        };
      return { updated: 2, unread: 0 };
    });
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    const bell = await screen.findByRole('button', {
      name: 'Notifications, 2 non lues',
    });
    fireEvent.click(bell);
    expect(
      await screen.findByRole('link', { name: 'Formation achetée' }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: /Tout marquer comme lu/ }),
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/notifications/read-all', {
        method: 'PATCH',
      }),
    );
    expect(
      screen.getByRole('button', { name: 'Notifications' }),
    ).toBeInTheDocument();
  });

  it('refreshes immediately when the live stream announces a notification', async () => {
    let onEvent: ((event: StreamEvent) => void) | undefined;
    subscribe.mockImplementation((_path: string, listener) => {
      onEvent = listener;
      return () => undefined;
    });
    request
      .mockResolvedValueOnce({ unread: 0 })
      .mockResolvedValueOnce({ unread: 1 });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(subscribe).toHaveBeenCalledWith(
        '/notifications/stream',
        expect.any(Function),
      ),
    );
    onEvent?.({
      type: 'notification',
      data: {
        id: 'n-live',
        type: 'PURCHASE_CONFIRMED',
        title: 'Formation achetée',
        message: 'Inscription confirmée.',
        timestamp: new Date().toISOString(),
        read: false,
      },
    });

    expect(
      await screen.findByRole('button', {
        name: 'Notifications, 1 non lues',
      }),
    ).toBeInTheDocument();
  });
});

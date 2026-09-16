import { Bell, Check, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';
import {
  NOTIFICATION_RECEIVED_EVENT,
  type NotificationItem,
  type NotificationPage,
} from './types.js';

function timestamp(value: string): string {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60_000) return 'À l’instant';
  if (elapsed < 3_600_000) return `Il y a ${Math.floor(elapsed / 60_000)} min`;
  if (elapsed < 86_400_000)
    return `Il y a ${Math.floor(elapsed / 3_600_000)} h`;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function NotificationBell() {
  const { request, subscribe } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const result = await request<{ unread: number }>(
      '/notifications/unread-count',
    );
    setUnread(result.unread);
  }, [request]);
  const loadRecent = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const page = await request<NotificationPage>(
        '/notifications?page=1&pageSize=8&state=ALL',
      );
      setItems(page.items);
      setUnread(page.unread);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    // Synchronize the badge with the server when the authenticated header mounts.
    // oxlint-disable-next-line react/set-state-in-effect
    void refreshCount().catch(() => undefined);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible')
        void refreshCount().catch(() => undefined);
    };
    const timer = window.setInterval(() => {
      refreshWhenVisible();
    }, 30_000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshCount]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(
    () =>
      subscribe<NotificationItem>('/notifications/stream', (event) => {
        if (event.type !== 'ready' && event.type !== 'notification') return;
        void refreshCount().catch(() => undefined);
        if (openRef.current) void loadRecent();
        if (event.type !== 'notification') return;
        window.dispatchEvent(
          new CustomEvent<NotificationItem>(NOTIFICATION_RECEIVED_EVENT, {
            detail: event.data,
          }),
        );
      }),
    [loadRecent, refreshCount, subscribe],
  );
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const markRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      await request(`/notifications/${item.id}/read`, { method: 'PATCH' });
      setItems((current) =>
        current.map((value) =>
          value.id === item.id ? { ...value, read: true } : value,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
    } catch {
      setError(true);
    }
  };
  const markAllRead = async () => {
    try {
      await request('/notifications/read-all', { method: 'PATCH' });
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="hsa-notifications" ref={root}>
      <button
        className="hsa-notification-button"
        type="button"
        aria-label={
          unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
        }
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          openRef.current = next;
          setOpen(next);
          if (next) void loadRecent();
        }}
      >
        <Bell size={21} aria-hidden="true" />
        {unread > 0 && (
          <span className="hsa-notification-badge">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          className="hsa-notification-panel"
          aria-label="Notifications récentes"
        >
          <header>
            <div>
              <h2>Notifications</h2>
              <span>
                {unread} non lue{unread > 1 ? 's' : ''}
              </span>
            </div>
            {unread > 0 && (
              <button type="button" onClick={() => void markAllRead()}>
                <CheckCheck size={16} aria-hidden="true" /> Tout marquer comme
                lu
              </button>
            )}
          </header>
          <div className="hsa-notification-list">
            {loading && <p className="hsa-tool-state">Chargement…</p>}
            {!loading && error && (
              <p className="hsa-tool-state hsa-tool-error">
                Impossible de charger les notifications.
              </p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="hsa-tool-state">
                <strong>Aucune notification</strong>
                <span>Vos mises à jour importantes apparaîtront ici.</span>
              </p>
            )}
            {!loading &&
              !error &&
              items.map((item) => (
                <article key={item.id} className={item.read ? '' : 'unread'}>
                  <span className="hsa-notification-dot" aria-hidden="true" />
                  <div>
                    {item.link ? (
                      <Link
                        to={item.link}
                        onClick={() => {
                          void markRead(item);
                          setOpen(false);
                        }}
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <strong>{item.title}</strong>
                    )}
                    <p>{item.message}</p>
                    <time dateTime={item.timestamp}>
                      {timestamp(item.timestamp)}
                    </time>
                  </div>
                  {!item.read && (
                    <button
                      type="button"
                      aria-label={`Marquer « ${item.title} » comme lue`}
                      onClick={() => void markRead(item)}
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                  )}
                </article>
              ))}
          </div>
          <footer>
            <Link to="/app/notifications" onClick={() => setOpen(false)}>
              Voir toutes les notifications
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}

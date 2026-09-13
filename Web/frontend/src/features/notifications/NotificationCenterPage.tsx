import { CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';
import { Pagination } from '../../shared/components/Pagination.js';
import {
  NOTIFICATION_RECEIVED_EVENT,
  type NotificationItem,
  type NotificationPage,
} from './types.js';

type StateFilter = 'ALL' | 'UNREAD' | 'READ';

export function NotificationCenterPage() {
  const { request } = useAuth();
  const [filter, setFilter] = useState<StateFilter>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setData(
        await request<NotificationPage>(
          `/notifications?page=${page}&pageSize=20&state=${filter}`,
        ),
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filter, page, request]);
  useEffect(() => {
    // Synchronize the page with its server-owned filter and pagination state.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener(NOTIFICATION_RECEIVED_EVENT, refresh);
    return () =>
      window.removeEventListener(NOTIFICATION_RECEIVED_EVENT, refresh);
  }, [load]);

  const markRead = async (item: NotificationItem) => {
    if (item.read) return;
    try {
      await request(`/notifications/${item.id}/read`, { method: 'PATCH' });
      await load();
    } catch {
      setError(true);
    }
  };
  const markAllRead = async () => {
    try {
      await request('/notifications/read-all', { method: 'PATCH' });
      await load();
    } catch {
      setError(true);
    }
  };

  return (
    <section className="content-page hsa-notification-center">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Mon espace</span>
          <h1>Notifications</h1>
          <p>
            Retrouvez les événements importants liés à vos formations et à votre
            compte.
          </p>
        </div>
        {(data?.unread ?? 0) > 0 && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => void markAllRead()}
          >
            <CheckCheck size={17} aria-hidden="true" /> Tout marquer comme lu
          </button>
        )}
      </div>
      <div
        className="hsa-notification-filters"
        role="group"
        aria-label="Filtrer les notifications"
      >
        {(
          [
            ['ALL', 'Toutes'],
            ['UNREAD', 'Non lues'],
            ['READ', 'Lues'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'active' : ''}
            aria-pressed={filter === value}
            onClick={() => {
              setFilter(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        className="content-card hsa-notification-center-list"
        aria-live="polite"
      >
        {loading && (
          <p className="hsa-tool-state">Chargement des notifications…</p>
        )}
        {!loading && error && (
          <div className="empty-state">
            <h2>Chargement impossible</h2>
            <p>Réessayez dans quelques instants.</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void load()}
            >
              Réessayer
            </button>
          </div>
        )}
        {!loading && !error && data?.items.length === 0 && (
          <div className="empty-state">
            <h2>Aucune notification</h2>
            <p>Aucune notification ne correspond à ce filtre.</p>
          </div>
        )}
        {!loading &&
          !error &&
          data?.items.map((item) => (
            <article key={item.id} className={item.read ? '' : 'unread'}>
              <span className="hsa-notification-dot" aria-hidden="true" />
              <div>
                {item.link ? (
                  <Link to={item.link} onClick={() => void markRead(item)}>
                    {item.title}
                  </Link>
                ) : (
                  <strong>{item.title}</strong>
                )}
                <p>{item.message}</p>
                <time dateTime={item.timestamp}>
                  {new Intl.DateTimeFormat('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  }).format(new Date(item.timestamp))}
                </time>
              </div>
              {!item.read && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void markRead(item)}
                >
                  Marquer comme lue
                </button>
              )}
            </article>
          ))}
      </div>
      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          disabled={loading}
          onPageChange={setPage}
          label="Pages de notifications"
        />
      )}
    </section>
  );
}

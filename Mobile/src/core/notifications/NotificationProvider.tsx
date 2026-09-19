import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { startPushNotifications } from './firebase-messaging';

type NotificationContextValue = {
  unread: number;
  refreshUnread: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue>({
  unread: 0,
  refreshUnread: async () => undefined,
});

export function NotificationProvider({ children }: React.PropsWithChildren) {
  const { status, request } = useAuth();
  const [unread, setUnread] = useState(0);
  const refreshUnread = useCallback(async () => {
    if (status !== 'authenticated') return;
    const result = await request<{ unread: number }>(
      '/notifications/unread-count',
    );
    setUnread(result.unread);
  }, [request, status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      // Reset server-owned state when the authenticated scope ends.
      // oxlint-disable-next-line react/set-state-in-effect
      setUnread(0);
      return;
    }
    let dispose: (() => void) | undefined;
    let active = true;
    void refreshUnread().catch(() => undefined);
    const timer = setInterval(
      () => void refreshUnread().catch(() => undefined),
      30_000,
    );
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshUnread().catch(() => undefined);
    });
    void startPushNotifications(request, () => {
      void refreshUnread().catch(() => undefined);
    })
      .then((cleanup) => {
        if (active) dispose = cleanup;
        else cleanup();
      })
      .catch(() => {
        // Notification setup is optional and must never interrupt authentication.
      });
    return () => {
      active = false;
      clearInterval(timer);
      appState.remove();
      dispose?.();
    };
  }, [refreshUnread, request, status]);
  const value = useMemo(
    () => ({ unread, refreshUnread }),
    [refreshUnread, unread],
  );
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components
export const useNotifications = () => useContext(NotificationContext);

import { useEffect } from 'react';

import { useAuth } from '../auth/AuthContext';
import { startPushNotifications } from './firebase-messaging';

export function NotificationProvider({ children }: React.PropsWithChildren) {
  const { status, request } = useAuth();
  useEffect(() => {
    if (status !== 'authenticated') return;
    let dispose: (() => void) | undefined;
    let active = true;
    void startPushNotifications(request)
      .then((cleanup) => {
        if (active) dispose = cleanup;
        else cleanup();
      })
      .catch(() => {
        // Notification setup is optional and must never interrupt authentication.
      });
    return () => {
      active = false;
      dispose?.();
    };
  }, [request, status]);
  return children;
}

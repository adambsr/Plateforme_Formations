import * as SecureStore from 'expo-secure-store';
import { PermissionsAndroid, Platform } from 'react-native';

import { openNotification } from '../../app/navigation/notification-navigation';

const tokenStorageKey = 'fcm-device-token';
export const notificationPreferenceKey = 'notification-permission-choice';
const channelId = 'hsa-default';

type AuthenticatedRequest = <T>(
  path: string,
  options?: RequestInit,
) => Promise<T>;

function notificationData(
  data: Record<string, string | object> | undefined,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(data ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

async function hasAndroidNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return true;
  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}

async function configureForegroundNotifications(): Promise<void> {
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: 'High Skills Academy',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

async function registerCurrentDevice(
  request: AuthenticatedRequest,
): Promise<void> {
  if (!(await hasAndroidNotificationPermission())) return;
  const { getMessaging, getToken, setAutoInitEnabled } =
    await import('@react-native-firebase/messaging');
  const messaging = getMessaging();
  await setAutoInitEnabled(messaging, true);
  const token = await getToken(messaging);
  if (token.length === 0) return;
  await request('/notifications/devices', {
    method: 'POST',
    body: JSON.stringify({ token, platform: 'ANDROID' }),
  });
  await SecureStore.setItemAsync(tokenStorageKey, token);
}

export async function enablePushNotifications(
  request: AuthenticatedRequest,
): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }
  await registerCurrentDevice(request);
  await SecureStore.setItemAsync(notificationPreferenceKey, 'enabled');
  return true;
}

export async function notificationPermissionState(): Promise<
  'enabled' | 'denied' | 'undecided'
> {
  if (await hasAndroidNotificationPermission()) return 'enabled';
  const choice = await SecureStore.getItemAsync(notificationPreferenceKey);
  return choice === 'declined' ? 'denied' : 'undecided';
}

export async function declinePushNotifications(): Promise<void> {
  await SecureStore.setItemAsync(notificationPreferenceKey, 'declined');
}

export async function unregisterPushDevice(
  request: AuthenticatedRequest,
): Promise<void> {
  const token = await SecureStore.getItemAsync(tokenStorageKey);
  if (token === null) return;
  try {
    await request('/notifications/devices', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    });
  } finally {
    await SecureStore.deleteItemAsync(tokenStorageKey);
  }
}

export async function startPushNotifications(
  request: AuthenticatedRequest,
): Promise<() => void> {
  await configureForegroundNotifications();
  // Permission is explicitly requested by NotificationPreferences.  Keep the
  // listeners alive for an already-authorized device without prompting again.
  if (await hasAndroidNotificationPermission()) await registerCurrentDevice(request);
  const messagingModule = await import('@react-native-firebase/messaging');
  const messaging = messagingModule.getMessaging();
  const handleMessage = async (message: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string | object>;
  }) => {
    const title = message.notification?.title;
    const body = message.notification?.body;
    if (title === undefined || body === undefined) return;
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data: notificationData(message.data) },
      trigger: null,
    });
  };
  const foregroundUnsubscribe = messagingModule.onMessage(
    messaging,
    (message) => {
      void handleMessage(message);
    },
  );
  const openedUnsubscribe = messagingModule.onNotificationOpenedApp(
    messaging,
    (message) => openNotification(notificationData(message.data)),
  );
  const tokenUnsubscribe = messagingModule.onTokenRefresh(messaging, () => {
    void registerCurrentDevice(request);
  });
  const initial = await messagingModule.getInitialNotification(messaging);
  if (initial !== null) openNotification(notificationData(initial.data));
  const Notifications = await import('expo-notifications');
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) =>
      openNotification(
        response.notification.request.content.data as Record<
          string,
          string | undefined
        >,
      ),
    );
  return () => {
    foregroundUnsubscribe();
    openedUnsubscribe();
    tokenUnsubscribe();
    responseSubscription.remove();
  };
}

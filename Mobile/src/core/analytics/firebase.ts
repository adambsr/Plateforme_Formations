import * as SecureStore from 'expo-secure-store';

const consentKey = 'analytics-consent';
const analyticsEnabled =
  process.env.EXPO_PUBLIC_FIREBASE_ANALYTICS_ENABLED === 'true';

export type AnalyticsConsent = 'granted' | 'denied' | undefined;
export type AnalyticsParameters = Record<string, string | number | boolean>;

export function canUseFirebaseAnalytics(): boolean {
  return analyticsEnabled;
}

export async function getAnalyticsConsent(): Promise<AnalyticsConsent> {
  const value = await SecureStore.getItemAsync(consentKey);
  return value === 'granted' || value === 'denied' ? value : undefined;
}

export async function setAnalyticsConsent(
  value: Exclude<AnalyticsConsent, undefined>,
): Promise<void> {
  await SecureStore.setItemAsync(consentKey, value);
  if (!analyticsEnabled) return;
  try {
    const { getAnalytics, setAnalyticsCollectionEnabled } =
      await import('@react-native-firebase/analytics');
    await setAnalyticsCollectionEnabled(getAnalytics(), value === 'granted');
  } catch (error) {
    if (__DEV__)
      console.warn('Firebase Analytics could not be configured.', error);
  }
}

export async function trackAnalyticsEvent(
  name: string,
  parameters: AnalyticsParameters = {},
): Promise<void> {
  if (!analyticsEnabled || (await getAnalyticsConsent()) !== 'granted') return;
  try {
    const { getAnalytics, logEvent } =
      await import('@react-native-firebase/analytics');
    await logEvent(getAnalytics(), name, parameters);
    if (__DEV__) console.info(`[Firebase Analytics] Event queued: ${name}`);
  } catch (error) {
    if (__DEV__)
      console.warn('Firebase Analytics event was not recorded.', error);
  }
}

export function trackScreenView(screenName: string): void {
  void trackAnalyticsEvent('screen_view', {
    firebase_screen: screenName,
    firebase_screen_class: screenName,
  });
}

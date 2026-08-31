import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from 'firebase/analytics';

const analyticsEnabled =
  import.meta.env.VITE_FIREBASE_ANALYTICS_ENABLED === 'true';
const analyticsConsentKey = 'analytics-consent';
const analyticsDevelopmentLogging = import.meta.env.DEV;
const analyticsDebug =
  import.meta.env.VITE_FIREBASE_ANALYTICS_DEBUG === 'true';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

function hasAnalyticsConfiguration(): boolean {
  return [
    firebaseConfig.apiKey,
    firebaseConfig.projectId,
    firebaseConfig.appId,
    firebaseConfig.measurementId,
  ].every((value) => typeof value === 'string' && value.length > 0);
}

export function canUseFirebaseAnalytics(): boolean {
  return analyticsEnabled && hasAnalyticsConfiguration();
}

let analyticsPromise: Promise<Analytics | undefined> | undefined;
let lastTrackedPage: string | undefined;

export type AnalyticsEventParameters = Record<
  string,
  string | number | boolean
>;

export type AnalyticsConsent = 'granted' | 'denied' | undefined;

export function getAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return undefined;
  const consent = window.localStorage.getItem(analyticsConsentKey);
  return consent === 'granted' || consent === 'denied' ? consent : undefined;
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, undefined>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(analyticsConsentKey, consent);
  // Allows the current route to be recorded immediately after consent.
  lastTrackedPage = undefined;
}

export function getFirebaseAnalytics(): Promise<Analytics | undefined> {
  if (
    !canUseFirebaseAnalytics() ||
    getAnalyticsConsent() !== 'granted'
  ) {
    return Promise.resolve(undefined);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => {
      if (!supported) return undefined;

      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      const analytics = initializeAnalytics(app, {
        config: { send_page_view: false },
      });
      if (analyticsDevelopmentLogging) {
        console.info(
          '[Firebase Analytics] Initialized. Use Firebase Analytics DebugView to inspect events.',
        );
      }
      return analytics;
    })
    .catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('Firebase Analytics could not be initialized.', error);
      }
      return undefined;
    });

  return analyticsPromise;
}

export function trackPageView(path: string): void {
  if (path === lastTrackedPage) return;
  lastTrackedPage = path;

  void getFirebaseAnalytics().then((analytics) => {
    if (analytics === undefined) return;
    logAnalyticsEvent(analytics, 'page_view', {
      page_location: window.location.href,
      page_path: path,
      page_title: document.title,
    });
  });
}

/** Records a privacy-safe product event when Analytics is explicitly enabled. */
export function trackAnalyticsEvent(
  name: string,
  parameters: AnalyticsEventParameters,
): void {
  void getFirebaseAnalytics().then((analytics) => {
    if (analytics === undefined) return;
    logAnalyticsEvent(analytics, name, parameters);
  });
}

function logAnalyticsEvent(
  analytics: Analytics,
  name: string,
  parameters: AnalyticsEventParameters,
): void {
  logEvent(
    analytics,
    name,
    analyticsDebug ? { ...parameters, debug_mode: true } : parameters,
  );
  if (analyticsDevelopmentLogging) {
    console.info(`[Firebase Analytics] Event queued: ${name}`);
  }
}

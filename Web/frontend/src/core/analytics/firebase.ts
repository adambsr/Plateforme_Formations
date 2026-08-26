import { getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  initializeAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from 'firebase/analytics';

const analyticsEnabled =
  import.meta.env.VITE_FIREBASE_ANALYTICS_ENABLED === 'true';

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

let analyticsPromise: Promise<Analytics | undefined> | undefined;
let lastTrackedPage: string | undefined;

export function getFirebaseAnalytics(): Promise<Analytics | undefined> {
  if (!analyticsEnabled || !hasAnalyticsConfiguration()) {
    return Promise.resolve(undefined);
  }

  analyticsPromise ??= isSupported()
    .then((supported) => {
      if (!supported) return undefined;

      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      return initializeAnalytics(app, {
        config: { send_page_view: false },
      });
    })
    .catch(() => undefined);

  return analyticsPromise;
}

export function trackPageView(path: string): void {
  if (path === lastTrackedPage) return;
  lastTrackedPage = path;

  void getFirebaseAnalytics().then((analytics) => {
    if (analytics === undefined) return;
    logEvent(analytics, 'page_view', {
      page_location: window.location.href,
      page_path: path,
      page_title: document.title,
    });
  });
}

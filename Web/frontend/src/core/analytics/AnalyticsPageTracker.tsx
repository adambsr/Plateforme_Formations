import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { trackPageView } from './firebase.js';

/** Records one Firebase Analytics page view for each client-side route. */
export function AnalyticsPageTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Query strings may contain one-time reset or payment references.
    trackPageView(pathname);
  }, [pathname]);

  return null;
}

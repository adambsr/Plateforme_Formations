import { useEffect } from 'react';
import { useLocation } from 'react-router';

import { trackPageView } from './firebase.js';

/** Records one Firebase Analytics page view for each client-side route. */
export function AnalyticsPageTracker() {
  const { hash, pathname, search } = useLocation();

  useEffect(() => {
    trackPageView(`${pathname}${search}${hash}`);
  }, [hash, pathname, search]);

  return null;
}

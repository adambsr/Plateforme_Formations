import { useState } from 'react';
import { useLocation } from 'react-router';

import {
  canUseFirebaseAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
  trackPageView,
} from './firebase.js';

/** Lets visitors opt in to optional Firebase product-measurement events. */
export function AnalyticsConsentBanner() {
  const location = useLocation();
  const [consent, setConsent] = useState(getAnalyticsConsent);

  if (!canUseFirebaseAnalytics() || consent !== undefined) return null;

  function choose(value: 'granted' | 'denied') {
    setAnalyticsConsent(value);
    setConsent(value);
    if (value === 'granted') {
      trackPageView(`${location.pathname}${location.search}${location.hash}`);
    }
  }

  return (
    <aside className='analytics-consent' aria-label='Choix des statistiques'>
      <p>
        Nous utilisons des statistiques facultatives pour mesurer les
        recommandations de formation. Elles ne contiennent ni nom, ni email,
        ni donnée de paiement.
      </p>
      <div>
        <button className='secondary-button' onClick={() => choose('denied')}>
          Refuser
        </button>
        <button className='primary-button' onClick={() => choose('granted')}>
          Accepter
        </button>
      </div>
    </aside>
  );
}

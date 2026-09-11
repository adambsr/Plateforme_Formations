import { useState } from 'react';

import {
  canUseFirebaseAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from './firebase.js';

export function AnalyticsPreferences() {
  const [choice, setChoice] = useState<AnalyticsConsent>(getAnalyticsConsent);
  if (!canUseFirebaseAnalytics()) {
    return (
      <p className="muted">
        Les statistiques facultatives ne sont pas activées dans cet
        environnement.
      </p>
    );
  }
  function choose(value: 'granted' | 'denied') {
    setAnalyticsConsent(value);
    setChoice(value);
  }
  return (
    <div
      className="analytics-preferences"
      aria-label="Préférences de statistiques"
    >
      <p className="muted">
        Choix actuel :{' '}
        {choice === 'granted'
          ? 'acceptées'
          : choice === 'denied'
            ? 'refusées'
            : 'non défini'}
        .
      </p>
      <div>
        <button
          className="secondary-button"
          type="button"
          aria-pressed={choice === 'denied'}
          onClick={() => choose('denied')}
        >
          Refuser
        </button>
        <button
          className="primary-button"
          type="button"
          aria-pressed={choice === 'granted'}
          onClick={() => choose('granted')}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}

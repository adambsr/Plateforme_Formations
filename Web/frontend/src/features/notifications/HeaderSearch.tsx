import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAuth } from '../../core/auth/AuthContext.js';
import type { SearchResponse, SearchResultType } from './types.js';

const labels: Record<SearchResultType, string> = {
  TRAINING: 'Formations',
  LESSON: 'Cours',
  SESSION: 'Sessions',
  USER: 'Utilisateurs',
  EVALUATION: 'Évaluations',
  PAYMENT: 'Paiements',
  CERTIFICATE: 'Certificats',
};

export function HeaderSearch() {
  const { user, request } = useAuth();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const placeholder =
    user?.role === 'ADMIN'
      ? 'Rechercher un utilisateur, une formation, une session…'
      : user?.role === 'TRAINER'
        ? 'Rechercher une formation, un apprenant…'
        : 'Rechercher une formation, un cours…';

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setFocused(false);
        setMobileOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFocused(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Keep stale results out of the popover when the current query is invalid.
      // oxlint-disable-next-line react/set-state-in-effect
      setResponse(null);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      void request<SearchResponse>(
        `/search?q=${encodeURIComponent(trimmed)}&limit=5`,
      )
        .then((result) => {
          if (active) setResponse(result);
        })
        .catch(() => {
          if (!active) return;
          setError(true);
          setResponse(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 320);
    return () => {
      window.clearTimeout(timer);
      active = false;
    };
  }, [query, request]);

  const hasResults =
    response?.groups.some(({ items }) => items.length > 0) ?? false;
  return (
    <div
      className={
        mobileOpen ? 'hsa-search hsa-search-mobile-open' : 'hsa-search'
      }
      ref={root}
    >
      <button
        className="hsa-search-mobile-trigger"
        type="button"
        aria-label="Ouvrir la recherche"
        aria-expanded={mobileOpen}
        onClick={() => {
          setMobileOpen(true);
          window.setTimeout(() => input.current?.focus(), 0);
        }}
      >
        <Search size={20} aria-hidden="true" />
      </button>
      <div className="hsa-search-field">
        <Search size={19} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-controls="dashboard-search-results"
          aria-expanded={focused && query.trim().length >= 2}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
        />
        {mobileOpen && (
          <button
            className="hsa-search-close"
            type="button"
            aria-label="Fermer la recherche"
            onClick={() => {
              setMobileOpen(false);
              setFocused(false);
            }}
          >
            <X size={19} aria-hidden="true" />
          </button>
        )}
      </div>
      {focused && (
        <div
          className="hsa-search-results"
          id="dashboard-search-results"
          role="region"
          aria-live="polite"
        >
          {query.trim().length < 2 && (
            <p className="hsa-tool-state">
              <strong>
                {query.trim().length === 0
                  ? 'Que recherchez-vous ?'
                  : 'Recherche trop courte'}
              </strong>
              <span>Saisissez au moins 2 caractères.</span>
            </p>
          )}
          {query.trim().length >= 2 && loading && (
            <p className="hsa-tool-state">Recherche en cours…</p>
          )}
          {query.trim().length >= 2 && !loading && error && (
            <p className="hsa-tool-state hsa-tool-error">
              La recherche est indisponible. Réessayez.
            </p>
          )}
          {query.trim().length >= 2 &&
            !loading &&
            !error &&
            response !== null &&
            !hasResults && (
              <p className="hsa-tool-state">
                <strong>Aucun résultat</strong>
                <span>Essayez un autre terme.</span>
              </p>
            )}
          {query.trim().length >= 2 &&
            !loading &&
            !error &&
            response?.groups.map((group) => (
              <section
                key={group.type}
                aria-labelledby={`search-${group.type}`}
              >
                <h2 id={`search-${group.type}`}>{labels[group.type]}</h2>
                {group.items.map((item) => (
                  <Link
                    key={`${item.type}-${item.id}`}
                    to={item.link}
                    onClick={() => {
                      setFocused(false);
                      setMobileOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="hsa-result-icon" aria-hidden="true">
                      {item.title.slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{item.title}</strong>
                      {item.subtitle && <small>{item.subtitle}</small>}
                    </span>
                  </Link>
                ))}
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

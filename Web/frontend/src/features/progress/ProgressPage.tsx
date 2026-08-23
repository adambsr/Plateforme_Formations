import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { PaginatedProgress } from './types.js';
import { Pagination } from '../../shared/components/Pagination.js';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

export function ProgressPage() {
  const { request } = useAuth();
  const [page, setPage] = useState<PaginatedProgress | null>(null);
  const [error, setError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);

  const load = useCallback(async () => {
    setError('');
    try {
      setPage(
        await request<PaginatedProgress>(
          `/progress?page=${pageNumber}&pageSize=12`,
        ),
      );
    } catch (caught) {
      setError(message(caught));
    }
  }, [pageNumber, request]);

  useEffect(() => {
    // Route entry synchronizes the server-calculated learner progression.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Autoformation</span>
          <h1>Ma progression</h1>
        </div>
        {page !== null && <span className="count-badge">{page.total}</span>}
      </div>
      {error !== '' && (
        <div className="form-error" role="alert">
          {error}{' '}
          <button className="link-button" onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      )}
      {page === null && error === '' ? (
        <p className="muted">Chargement de votre progression…</p>
      ) : page?.items.length === 0 ? (
        <div className="empty-state">
          <h2>Aucune formation en ligne autonome</h2>
          <p className="muted">
            Une formation apparaîtra ici après confirmation de son paiement.
          </p>
        </div>
      ) : (
        <>
          <div className="progress-grid">
            {page?.items.map((progress) => (
              <article
                className="content-card progress-card"
                key={progress.enrollmentId}
              >
                <div className="managed-training-heading">
                  <div>
                    <span className="eyebrow">
                      {progress.isComplete ? 'Terminée' : 'En cours'}
                    </span>
                    <h2>{progress.training.title}</h2>
                  </div>
                  <strong>{progress.percentage}%</strong>
                </div>
                <progress max="100" value={progress.percentage}>
                  {progress.percentage}%
                </progress>
                <p className="muted">
                  {progress.lockedByCertificate &&
                  progress.totalLessonCount === 0
                    ? 'Parcours validé et certifié.'
                    : `${progress.completedLessonCount}/${progress.totalLessonCount} leçon(s) terminée(s)`}
                </p>
                {progress.lockedByCertificate && (
                  <p className="success-message">
                    Progression verrouillée après émission du certificat.
                  </p>
                )}
                <Link
                  className="primary-button compact-button"
                  to={`/app/content/${progress.training.id}`}
                >
                  Ouvrir le contenu
                </Link>
              </article>
            ))}
          </div>
          {page && (
            <Pagination
              page={page.page}
              pageSize={page.pageSize}
              total={page.total}
              onPageChange={setPageNumber}
              label="Pages de progression"
            />
          )}
        </>
      )}
    </section>
  );
}

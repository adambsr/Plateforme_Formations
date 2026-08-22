import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type {
  Certificate,
  Enrollment,
  FeedbackStatistics,
  Page,
} from './types.js';

const ratings = [1, 2, 3, 4, 5] as const;

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function date(value: string): string {
  return new Intl.DateTimeFormat('fr-TN', {
    timeZone: 'Africa/Tunis',
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function CertificateFeedbackPage() {
  const { user, request, download } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [statistics, setStatistics] = useState<FeedbackStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submittedFeedback, setSubmittedFeedback] = useState<Set<string>>(
    new Set(),
  );

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const certificatePage = await request<Page<Certificate>>(
        '/certificates?pageSize=100',
      );
      setCertificates(certificatePage.items);
      if (user.role === 'LEARNER' || user.role === 'ADMIN') {
        const enrollmentPage = await request<Page<Enrollment>>(
          '/enrollments?pageSize=100',
        );
        setEnrollments(enrollmentPage.items);
      }
      if (user.role === 'ADMIN') {
        setStatistics(await request<FeedbackStatistics>('/feedback'));
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, user]);

  useEffect(() => {
    // Route entry loads role-authorized certificate and satisfaction data.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function generate(enrollmentId: string) {
    setBusy(`certificate:${enrollmentId}`);
    setError('');
    setSuccess('');
    try {
      const certificate = await request<Certificate>('/certificates/generate', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId }),
      });
      setCertificates((current) => [
        certificate,
        ...current.filter(({ id }) => id !== certificate.id),
      ]);
      setSuccess('Le certificat est prêt au téléchargement.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy('');
    }
  }

  async function rate(enrollmentId: string, rating: number) {
    setBusy(`feedback:${enrollmentId}`);
    setError('');
    setSuccess('');
    try {
      await request('/feedback', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, rating }),
      });
      setSubmittedFeedback((current) => new Set(current).add(enrollmentId));
      setSuccess('Merci, votre note de satisfaction a été enregistrée.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy('');
    }
  }

  async function downloadCertificate(certificate: Certificate) {
    setError('');
    try {
      const blob = await download(`/certificates/${certificate.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${certificate.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(message(caught));
    }
  }

  if (user === null) return null;
  const byEnrollment = new Map(
    certificates.map((certificate) => [certificate.enrollmentId, certificate]),
  );

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Achèvement vérifié par le backend</span>
          <h1>
            {user.role === 'ADMIN'
              ? 'Certificats et satisfaction'
              : user.role === 'TRAINER'
                ? 'Certificats de mes formations'
                : 'Mes certificats et avis'}
          </h1>
        </div>
        <button className="secondary-button" onClick={() => void load()}>
          Actualiser
        </button>
      </div>
      {error !== '' && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {success !== '' && (
        <p className="form-success" role="status">
          {success}
        </p>
      )}
      {loading ? (
        <p className="muted">
          Vérification des certificats et de l'éligibilité…
        </p>
      ) : (
        <div className="certificate-sections">
          {(user.role === 'LEARNER' || user.role === 'ADMIN') && (
            <section className="content-card">
              <h2>
                {user.role === 'ADMIN'
                  ? 'Génération par inscription'
                  : 'Mes formations terminées'}
              </h2>
              {enrollments.length === 0 ? (
                <p className="muted">Aucune inscription confirmée.</p>
              ) : (
                <ul className="certificate-list">
                  {enrollments.map((enrollment) => {
                    const certificate = byEnrollment.get(enrollment.id);
                    return (
                      <li key={enrollment.id}>
                        <div>
                          <strong>{enrollment.training.title}</strong>
                          <span>
                            {enrollment.session?.title ??
                              'Formation en autonomie'}
                            {user.role === 'ADMIN'
                              ? ` · ${enrollment.learner.firstName ?? enrollment.learner.email}`
                              : ''}
                          </span>
                        </div>
                        <div className="certificate-actions">
                          {certificate === undefined ? (
                            <button
                              className="primary-button"
                              disabled={busy === `certificate:${enrollment.id}`}
                              onClick={() => void generate(enrollment.id)}
                            >
                              Générer le certificat
                            </button>
                          ) : (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                void downloadCertificate(certificate)
                              }
                            >
                              Télécharger {certificate.number}
                            </button>
                          )}
                          {user.role === 'LEARNER' &&
                            (submittedFeedback.has(enrollment.id) ? (
                              <span className="status-pill status-paid">
                                Avis enregistré
                              </span>
                            ) : (
                              <div
                                className="rating-control"
                                aria-label={`Noter ${enrollment.training.title}`}
                              >
                                {ratings.map((rating) => (
                                  <button
                                    key={rating}
                                    type="button"
                                    title={`${rating} étoile${rating > 1 ? 's' : ''}`}
                                    aria-label={`Noter ${rating} étoile${rating > 1 ? 's' : ''}`}
                                    disabled={
                                      busy === `feedback:${enrollment.id}`
                                    }
                                    onClick={() =>
                                      void rate(enrollment.id, rating)
                                    }
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="muted">
                La génération et la note sont refusées tant que la complétion ou
                l'évaluation certifiante requise n'est pas satisfaite.
              </p>
            </section>
          )}

          <section className="content-card">
            <h2>Certificats émis</h2>
            {certificates.length === 0 ? (
              <p className="muted">Aucun certificat émis.</p>
            ) : (
              <ul className="certificate-list">
                {certificates.map((certificate) => (
                  <li key={certificate.id}>
                    <div>
                      <strong>{certificate.training.title}</strong>
                      <span>
                        {certificate.learner.firstName}{' '}
                        {certificate.learner.lastName} · Émis le{' '}
                        {date(certificate.issuedAt)}
                      </span>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => void downloadCertificate(certificate)}
                    >
                      PDF {certificate.number}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {user.role === 'ADMIN' && statistics !== null && (
            <section className="content-card">
              <h2>Satisfaction</h2>
              <p className="satisfaction-total">
                <strong>{statistics.global.count}</strong> notes · moyenne{' '}
                <strong>
                  {statistics.global.average === null
                    ? '—'
                    : `${statistics.global.average.toFixed(2)} / 5`}
                </strong>
              </p>
              <p className="muted">
                Distribution globale :{' '}
                {ratings
                  .map(
                    (rating) =>
                      `${rating}★ ${statistics.global.distribution[rating]}`,
                  )
                  .join(' · ')}
              </p>
              {statistics.byTraining.length === 0 ? (
                <p className="muted">Aucune satisfaction enregistrée.</p>
              ) : (
                <ul className="certificate-list">
                  {statistics.byTraining.map((entry) => (
                    <li key={entry.training.id}>
                      <strong>{entry.training.title}</strong>
                      <span>
                        {entry.count} notes · moyenne{' '}
                        {entry.average?.toFixed(2) ?? '—'} / 5
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}

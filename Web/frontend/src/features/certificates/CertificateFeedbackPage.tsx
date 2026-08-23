import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type {
  Certificate,
  Enrollment,
  FeedbackStatistics,
  Page,
} from './types.js';
import { Pagination } from '../../shared/components/Pagination.js';
import { Select } from '../../shared/components/Select.js';

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
  const [certificatePage, setCertificatePage] =
    useState<Page<Certificate> | null>(null);
  const [enrollmentPage, setEnrollmentPage] = useState<Page<Enrollment> | null>(
    null,
  );
  const [certificatePageNumber, setCertificatePageNumber] = useState(1);
  const [enrollmentPageNumber, setEnrollmentPageNumber] = useState(1);
  const [statistics, setStatistics] = useState<FeedbackStatistics | null>(null);
  const [satisfactionTrainingId, setSatisfactionTrainingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const certificateResult = await request<Page<Certificate>>(
        `/certificates?page=${certificatePageNumber}&pageSize=10`,
      );
      setCertificates(certificateResult.items);
      setCertificatePage(certificateResult);
      if (user.role === 'LEARNER' || user.role === 'ADMIN') {
        const enrollmentResult = await request<Page<Enrollment>>(
          `/enrollments?page=${enrollmentPageNumber}&pageSize=10`,
        );
        setEnrollments(enrollmentResult.items);
        setEnrollmentPage(enrollmentResult);
      }
      if (user.role === 'ADMIN') {
        setStatistics(await request<FeedbackStatistics>('/feedback'));
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [certificatePageNumber, enrollmentPageNumber, request, user]);

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
      const feedback = await request<{ rating: number; createdAt: string }>(
        '/feedback',
        {
          method: 'POST',
          body: JSON.stringify({ enrollmentId, rating }),
        },
      );
      setEnrollments((current) =>
        current.map((enrollment) =>
          enrollment.id === enrollmentId
            ? { ...enrollment, feedback }
            : enrollment,
        ),
      );
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
  const satisfactionSummary =
    satisfactionTrainingId === ''
      ? statistics?.global
      : statistics?.byTraining.find(
          ({ training }) => training.id === satisfactionTrainingId,
        );

  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Achèvement vérifié par le backend</span>
          <h1>
            {user.role === 'ADMIN'
              ? 'Certificats & satisfaction'
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
                  : 'Mes inscriptions, certificats et avis'}
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
                          {certificate === undefined &&
                          enrollment.eligibility?.eligible === true ? (
                            <button
                              className="primary-button"
                              disabled={busy === `certificate:${enrollment.id}`}
                              onClick={() => void generate(enrollment.id)}
                            >
                              Générer le certificat
                            </button>
                          ) : certificate !== undefined ? (
                            <button
                              className="secondary-button"
                              onClick={() =>
                                void downloadCertificate(certificate)
                              }
                            >
                              Télécharger {certificate.number}
                            </button>
                          ) : (
                            <span className="status-pill">
                              Conditions à finaliser
                            </span>
                          )}
                          {user.role === 'LEARNER' &&
                            (enrollment.feedback !== undefined ? (
                              <span className="status-pill status-paid">
                                Avis enregistré · {enrollment.feedback.rating}/5
                              </span>
                            ) : enrollment.eligibility?.eligible === true ? (
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
                            ) : (
                              <span className="muted">Avis indisponible</span>
                            ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {enrollmentPage && (
                <Pagination
                  page={enrollmentPage.page}
                  pageSize={enrollmentPage.pageSize}
                  total={enrollmentPage.total}
                  onPageChange={setEnrollmentPageNumber}
                  disabled={loading}
                  label="Pages des inscriptions certifiables"
                />
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
            {certificatePage && (
              <Pagination
                page={certificatePage.page}
                pageSize={certificatePage.pageSize}
                total={certificatePage.total}
                onPageChange={setCertificatePageNumber}
                disabled={loading}
                label="Pages des certificats"
              />
            )}
          </section>

          {user.role === 'ADMIN' && statistics !== null && (
            <section className="content-card">
              <h2>Satisfaction</h2>
              <label className="satisfaction-filter">
                Formation
                <Select
                  value={satisfactionTrainingId}
                  onChange={(event) =>
                    setSatisfactionTrainingId(event.target.value)
                  }
                >
                  <option value="">Vue globale</option>
                  {statistics.byTraining.map(({ training }) => (
                    <option key={training.id} value={training.id}>
                      {training.title}
                    </option>
                  ))}
                </Select>
              </label>
              <p className="satisfaction-total">
                <strong>{satisfactionSummary?.count ?? 0}</strong> notes ·
                moyenne{' '}
                <strong>
                  {satisfactionSummary?.average == null
                    ? '—'
                    : `${satisfactionSummary.average.toFixed(2)} / 5`}
                </strong>
              </p>
              <p className="muted">
                Distribution{satisfactionTrainingId === '' ? ' globale' : ''} :{' '}
                {ratings
                  .map(
                    (rating) =>
                      `${rating}★ ${satisfactionSummary?.distribution[rating] ?? 0}`,
                  )
                  .join(' · ')}
              </p>
              {statistics.byTraining.length === 0 ? (
                <p className="muted">Aucune satisfaction enregistrée.</p>
              ) : satisfactionTrainingId === '' ? (
                <p className="muted">
                  Sélectionnez une formation pour consulter son résultat.
                </p>
              ) : null}
            </section>
          )}
        </div>
      )}
    </section>
  );
}

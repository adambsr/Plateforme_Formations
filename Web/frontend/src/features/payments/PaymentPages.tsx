import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '../../core/api/client.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import type { Enrollment, Invoice, Page, Payment } from './types.js';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function money(value: number): string {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function date(value: string): string {
  return new Intl.DateTimeFormat('fr-TN', {
    timeZone: 'Africa/Tunis',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: Payment['status']): string {
  return {
    PENDING: 'En attente du webhook',
    PAID: 'Payé',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
  }[status];
}

export function CheckoutReturnPage({
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const [parameters] = useSearchParams();
  const paymentId = parameters.get('paymentId');
  const { request } = useAuth();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (paymentId === null) return;
    try {
      setPayment(await request<Payment>(`/payments/${paymentId}`));
      setError('');
    } catch (caught) {
      setError(message(caught));
    }
  }, [paymentId, request]);

  useEffect(() => {
    // The return route polls backend-owned Payment state; the redirect itself is
    // deliberately not treated as proof of payment.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
    const interval =
      payment?.status === 'PENDING' || payment === null
        ? window.setInterval(() => void load(), 2_000)
        : undefined;
    return () => {
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [load, payment?.status, payment]);

  return (
    <main className="checkout-return-page">
      <article className="content-card checkout-return-card">
        <span className="eyebrow">Stripe test</span>
        <h1>{cancelled ? 'Checkout quitté' : 'Confirmation en cours'}</h1>
        <p className="muted">
          {cancelled
            ? 'Le retour du navigateur ne modifie pas le paiement. Seul le webhook Stripe confirme son état.'
            : 'Le retour Stripe ne donne aucun accès à lui seul. Nous vérifions le paiement confirmé par le webhook.'}
        </p>
        {paymentId === null ? (
          <p className="form-error" role="alert">
            Référence de paiement manquante.
          </p>
        ) : error !== '' ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : payment === null ? (
          <p className="muted">Vérification du paiement…</p>
        ) : (
          <div className="payment-result">
            <span
              className={`status-pill status-${payment.status.toLowerCase()}`}
            >
              {statusLabel(payment.status)}
            </span>
            <h2>{payment.training.title}</h2>
            <p>{money(payment.amountMinor)}</p>
            {payment.status === 'PENDING' && (
              <p className="muted">
                Le webhook n’a pas encore confirmé le paiement.
              </p>
            )}
            {payment.failure !== undefined && (
              <p className="form-error">{payment.failure.message}</p>
            )}
            {payment.enrollmentId !== undefined && (
              <Link
                className="primary-link"
                to={`/app/content/${payment.training.id}`}
              >
                Accéder à la formation
              </Link>
            )}
          </div>
        )}
        <Link to="/app/payments">Voir mes paiements et factures</Link>
      </article>
    </main>
  );
}

export function PaymentCenterPage() {
  const { user, request, download } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [paymentPage, enrollmentPage, invoicePage] = await Promise.all([
        request<Page<Payment>>('/payments?pageSize=100'),
        request<Page<Enrollment>>('/enrollments?pageSize=100'),
        request<Page<Invoice>>('/invoices?pageSize=100'),
      ]);
      setPayments(paymentPage.items);
      setEnrollments(enrollmentPage.items);
      setInvoices(invoicePage.items);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    // Route entry synchronizes the webhook-confirmed financial records.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function downloadInvoice(invoice: Invoice) {
    try {
      const blob = await download(`/invoices/${invoice.id}/pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoice.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(message(caught));
    }
  }

  if (user === null) return null;
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Stripe test · TND</span>
          <h1>
            {user.role === 'ADMIN' ? 'Paiements et factures' : 'Mes achats'}
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
      {loading ? (
        <p className="muted">Chargement des données confirmées…</p>
      ) : (
        <div className="financial-sections">
          <section className="content-card">
            <h2>Paiements</h2>
            {payments.length === 0 ? (
              <p className="muted">Aucune tentative de paiement.</p>
            ) : (
              <ul className="financial-list">
                {payments.map((payment) => (
                  <li key={payment.id}>
                    <div>
                      <strong>{payment.training.title}</strong>
                      <span>
                        {date(payment.createdAt)} · {money(payment.amountMinor)}
                      </span>
                    </div>
                    <span
                      className={`status-pill status-${payment.status.toLowerCase()}`}
                    >
                      {statusLabel(payment.status)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="content-card">
            <h2>Inscriptions actives</h2>
            {enrollments.length === 0 ? (
              <p className="muted">Aucune inscription confirmée par webhook.</p>
            ) : (
              <ul className="financial-list">
                {enrollments.map((enrollment) => (
                  <li key={enrollment.id}>
                    <div>
                      <strong>{enrollment.training.title}</strong>
                      <span>
                        {enrollment.session?.title ?? 'Formation autonome'} ·{' '}
                        {date(enrollment.createdAt)}
                      </span>
                    </div>
                    {user.role === 'LEARNER' && (
                      <Link to={`/app/content/${enrollment.training.id}`}>
                        Ouvrir
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="content-card">
            <h2>Factures</h2>
            {invoices.length === 0 ? (
              <p className="muted">Aucune facture émise.</p>
            ) : (
              <ul className="financial-list">
                {invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <div>
                      <strong>{invoice.number}</strong>
                      <span>
                        {invoice.purchaseDescription} ·{' '}
                        {money(invoice.totalMinor)}
                      </span>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => void downloadInvoice(invoice)}
                    >
                      PDF
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

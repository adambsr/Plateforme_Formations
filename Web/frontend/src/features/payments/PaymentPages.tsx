import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Download, RefreshCw } from 'lucide-react';

import { ApiError } from '../../core/api/client.js';
import { trackRecommendationEnrollment } from '../../core/analytics/recommendation-analytics.js';
import { useAuth } from '../../core/auth/AuthContext.js';
import { Pagination } from '../../shared/components/Pagination.js';
import type { Invoice, Page, Payment } from './types.js';
import type { User } from '../../core/auth/types.js';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function money(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value / 100);
}

function date(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h23',
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

  useEffect(() => {
    if (payment?.status !== 'PAID' || payment.enrollmentId === undefined) {
      return;
    }
    trackRecommendationEnrollment(payment.training.id);
  }, [payment?.enrollmentId, payment?.status, payment?.training.id]);

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
  const [payments, setPayments] = useState<Page<Payment> | null>(null);
  const [invoices, setInvoices] = useState<Page<Invoice> | null>(null);
  const [paymentPage, setPaymentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [paymentResult, invoiceResult] =
        await Promise.all([
          request<Page<Payment>>(`/payments?page=${paymentPage}&pageSize=10`),
          request<Page<Invoice>>('/invoices?page=1&pageSize=100'),
        ]);
      setPayments(paymentResult);
      setInvoices(invoiceResult);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [paymentPage, request]);

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
    <PaymentLedger
      user={user}
      payments={payments}
      invoices={invoices}
      loading={loading}
      error={error}
      refresh={load}
      downloadInvoice={downloadInvoice}
      page={paymentPage}
      setPage={setPaymentPage}
    />
  );
  /*
  const invoicesByPayment = new Map(
    invoices?.items.map((invoice) => [invoice.paymentId, invoice]) ?? [],
  );
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Stripe test · EUR</span>
          <h1>
            {user.role === 'ADMIN' ? 'Paiements et factures' : 'Mes achats'}
          </h1>
        </div>
        <button className="secondary-button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" size={16} />
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
            <h2>Paiements et factures</h2>
            {payments?.items.length === 0 ? (
              <p className="muted">Aucune tentative de paiement.</p>
            ) : (
              <ul className="financial-list">
                {payments?.items.map((payment) => (
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
                    {invoicesByPayment.get(payment.id) ? (
                      <button
                        className="secondary-button compact-button"
                        onClick={() =>
                          void downloadInvoice(invoicesByPayment.get(payment.id)!)
                        }
                      >
                        <Download aria-hidden="true" size={16} /> Télécharger
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {payments && (
              <Pagination
                page={payments.page}
                pageSize={payments.pageSize}
                total={payments.total}
                onPageChange={setPaymentPage}
                disabled={loading}
                label="Pages des paiements"
              />
            )}
          </section>
          <section className="content-card">
            <h2>Inscriptions actives</h2>
            {enrollments?.items.length === 0 ? (
              <p className="muted">Aucune inscription confirmée par webhook.</p>
            ) : (
              <ul className="financial-list">
                {enrollments?.items.map((enrollment) => (
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
            {enrollments && (
              <Pagination
                page={enrollments.page}
                pageSize={enrollments.pageSize}
                total={enrollments.total}
                onPageChange={setEnrollmentPage}
                disabled={loading}
                label="Pages des inscriptions"
              />
            )}
          </section>
          <section className="content-card">
            <h2>Factures</h2>
            {invoices?.items.length === 0 ? (
              <p className="muted">Aucune facture émise.</p>
            ) : (
              <ul className="financial-list">
                {invoices?.items.map((invoice) => (
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
            {invoices && (
              <Pagination
                page={invoices.page}
                pageSize={invoices.pageSize}
                total={invoices.total}
                onPageChange={setInvoicePage}
                disabled={loading}
                label="Pages des factures"
              />
            )}
          </section>
        </div>
      )}
    </section>
  );
}
*/
}

function PaymentLedger({
  user,
  payments,
  invoices,
  loading,
  error,
  refresh,
  downloadInvoice,
  page,
  setPage,
}: {
  user: User;
  payments: Page<Payment> | null;
  invoices: Page<Invoice> | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  downloadInvoice: (invoice: Invoice) => Promise<void>;
  page: number;
  setPage: (page: number) => void;
}) {
  const invoicesByPayment = new Map(
    invoices?.items.map((invoice) => [invoice.paymentId, invoice]) ?? [],
  );
  return (
    <section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Stripe test · EUR</span>
          <h1>{user.role === 'ADMIN' ? 'Paiements et factures' : 'Mes achats'}</h1>
        </div>
        <button className="secondary-button" onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" size={16} /> Actualiser
        </button>
      </div>
      {error !== '' && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="muted">Chargement des données confirmées…</p> : (
        <section className="content-card payment-ledger">
          <div className="ledger-heading">
            <div><h2>Historique des paiements</h2><p className="muted">Les factures sont disponibles dès leur émission.</p></div>
            <span className="count-badge">{payments?.total ?? 0}</span>
          </div>
          {payments?.items.length === 0 ? <p className="muted">Aucun paiement.</p> : (
            <div className="responsive-table payment-table" role="table">
              <div className="table-row table-head" role="row">
                <span role="columnheader">Utilisateur</span><span role="columnheader">Formation</span><span role="columnheader">Statut</span><span role="columnheader">Facture</span>
              </div>
              {payments?.items.map((payment) => {
                const invoice = invoicesByPayment.get(payment.id);
                const name = invoice === undefined
                  ? (user.profile.firstName ?? user.email)
                  : [invoice.learner.firstName, invoice.learner.lastName].filter(Boolean).join(' ') || invoice.learner.email;
                return <div className="table-row" role="row" key={payment.id}>
                  <span role="cell"><strong>{name}</strong><small>{invoice?.learner.email ?? user.email}</small></span>
                  <span role="cell"><strong>{payment.training.title}</strong><small>{date(payment.createdAt)} · {money(payment.amountMinor)}</small></span>
                  <span role="cell" className={`status-pill status-${payment.status.toLowerCase()}`}>{statusLabel(payment.status)}</span>
                  <span role="cell">{invoice ? <button className="secondary-button compact-button" onClick={() => void downloadInvoice(invoice)}><Download aria-hidden="true" size={16} /> Télécharger</button> : <span className="muted">Non disponible</span>}</span>
                </div>;
              })}
            </div>
          )}
          {payments && <Pagination page={page} pageSize={payments.pageSize} total={payments.total} onPageChange={setPage} disabled={loading} label="Pages des paiements" />}
        </section>
      )}
    </section>
  );
}

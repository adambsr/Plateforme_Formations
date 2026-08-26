import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { shareFile } from '../../core/files/share';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatTunisDateTime } from '../../shared/utils/format';
import { formatEur } from '../trainings/format';
import type {
  Enrollment,
  Invoice,
  Page,
  Payment,
  PaymentStatus,
} from './types';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function statusLabel(status: PaymentStatus): string {
  return {
    PENDING: 'En attente du webhook',
    PAID: 'Payé',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
  }[status];
}

function Pager({
  page,
  setPage,
}: {
  page: Page<unknown>;
  setPage: (value: number) => void;
}) {
  if (page.total <= page.pageSize) return null;
  return (
    <View style={styles.pager}>
      <Button
        disabled={page.page <= 1}
        label="Précédent"
        onPress={() => setPage(page.page - 1)}
        variant="secondary"
      />
      <Text style={styles.muted}>Page {page.page}</Text>
      <Button
        disabled={page.page * page.pageSize >= page.total}
        label="Suivant"
        onPress={() => setPage(page.page + 1)}
        variant="secondary"
      />
    </View>
  );
}

export function CheckoutReturnScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, 'CheckoutReturn'>) {
  const { request } = useAuth();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState('');
  const paymentId = route.params?.paymentId;
  const cancelled = route.params?.result === 'cancel';

  const load = useCallback(async () => {
    if (paymentId === undefined) return;
    try {
      setPayment(await request<Payment>(`/payments/${paymentId}`));
      setError('');
    } catch (caught) {
      setError(message(caught));
    }
  }, [paymentId, request]);

  useEffect(() => {
    // The redirect is never proof of payment; poll backend-owned webhook state.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
    const interval =
      payment === null || payment.status === 'PENDING'
        ? setInterval(() => void load(), 2_000)
        : undefined;
    return () => {
      if (interval !== undefined) clearInterval(interval);
    };
  }, [load, payment?.status, payment]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>STRIPE TEST · EUR</Text>
          <Text style={styles.title}>
            {cancelled ? 'Checkout quitté' : 'Confirmation en cours'}
          </Text>
          <Text style={styles.muted}>
            Le retour du navigateur ne confirme jamais le paiement. Seul le
            webhook backend accorde l’accès.
          </Text>
        </View>
        {paymentId === undefined ? (
          <StatePanel message="Référence de paiement manquante." />
        ) : error !== '' ? (
          <StatePanel message={error} retry={() => void load()} />
        ) : payment === null ? (
          <StatePanel loading message="Vérification du paiement…" />
        ) : (
          <View style={styles.card}>
            <Text style={styles.status}>{statusLabel(payment.status)}</Text>
            <Text style={styles.cardTitle}>{payment.training.title}</Text>
            <Text style={styles.amount}>{formatEur(payment.amountMinor)}</Text>
            {payment.status === 'PENDING' && (
              <Text style={styles.muted}>
                Le webhook n’a pas encore confirmé le paiement.
              </Text>
            )}
            {payment.failure !== undefined && (
              <Notice message={payment.failure.message} />
            )}
            {payment.enrollmentId !== undefined && (
              <Button
                label="Accéder à la formation"
                onPress={() =>
                  navigation.navigate('Content', {
                    trainingId: payment.training.id,
                  })
                }
              />
            )}
          </View>
        )}
        <Button
          label="Voir mes achats"
          onPress={() => navigation.navigate('Purchases')}
          variant="secondary"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

export function PurchasesScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Purchases'>) {
  const { user, request, download } = useAuth();
  const [payments, setPayments] = useState<Page<Payment> | null>(null);
  const [enrollments, setEnrollments] = useState<Page<Enrollment> | null>(null);
  const [invoices, setInvoices] = useState<Page<Invoice> | null>(null);
  const [paymentPage, setPaymentPage] = useState(1);
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [paymentResult, enrollmentResult, invoiceResult] =
        await Promise.all([
          request<Page<Payment>>(`/payments?page=${paymentPage}&pageSize=10`),
          request<Page<Enrollment>>(
            `/enrollments?page=${enrollmentPage}&pageSize=10`,
          ),
          request<Page<Invoice>>(`/invoices?page=${invoicePage}&pageSize=10`),
        ]);
      setPayments(paymentResult);
      setEnrollments(enrollmentResult);
      setInvoices(invoiceResult);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [enrollmentPage, invoicePage, paymentPage, request]);

  useEffect(() => {
    // Pages synchronize webhook-confirmed financial records.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function openInvoice(invoice: Invoice) {
    setDownloadingId(invoice.id);
    setError('');
    try {
      await shareFile(
        await download(`/invoices/${invoice.id}/pdf`, `${invoice.number}.pdf`),
        'application/pdf',
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setDownloadingId(undefined);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && payments !== null}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>STRIPE TEST · EUR</Text>
          <Text style={styles.title}>
            {user?.role === 'ADMIN' ? 'Paiements et factures' : 'Mes achats'}
          </Text>
        </View>
        {error !== '' && <Notice message={error} />}
        {loading && payments === null ? (
          <StatePanel loading message="Chargement des données confirmées…" />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Paiements</Text>
              {payments?.items.length === 0 && (
                <Text style={styles.muted}>Aucune tentative de paiement.</Text>
              )}
              {payments?.items.map((payment) => (
                <View key={payment.id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>
                      {payment.training.title}
                    </Text>
                    <Text style={styles.muted}>
                      {formatTunisDateTime(payment.createdAt)} ·{' '}
                      {formatEur(payment.amountMinor)}
                    </Text>
                  </View>
                  <Text style={styles.status}>
                    {statusLabel(payment.status)}
                  </Text>
                </View>
              ))}
              {payments && <Pager page={payments} setPage={setPaymentPage} />}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Inscriptions actives</Text>
              {enrollments?.items.length === 0 && (
                <Text style={styles.muted}>Aucune inscription confirmée.</Text>
              )}
              {enrollments?.items.map((enrollment) => (
                <View key={enrollment.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {enrollment.training.title}
                  </Text>
                  <Text style={styles.muted}>
                    {enrollment.session?.title ?? 'Formation autonome'}
                  </Text>
                  {user?.role === 'LEARNER' && (
                    <Button
                      label="Ouvrir"
                      onPress={() =>
                        navigation.navigate('Content', {
                          trainingId: enrollment.training.id,
                        })
                      }
                      variant="secondary"
                    />
                  )}
                </View>
              ))}
              {enrollments && (
                <Pager page={enrollments} setPage={setEnrollmentPage} />
              )}
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Factures</Text>
              {invoices?.items.length === 0 && (
                <Text style={styles.muted}>Aucune facture.</Text>
              )}
              {invoices?.items.map((invoice) => (
                <View key={invoice.id} style={styles.row}>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{invoice.number}</Text>
                    <Text style={styles.muted}>
                      {invoice.purchaseDescription} ·{' '}
                      {formatEur(invoice.totalMinor)}
                    </Text>
                  </View>
                  <View style={styles.downloadAction}>
                    <Button
                      label="PDF"
                      loading={downloadingId === invoice.id}
                      onPress={() => void openInvoice(invoice)}
                      variant="secondary"
                    />
                  </View>
                </View>
              ))}
              {invoices && <Pager page={invoices} setPage={setInvoicePage} />}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 40 },
  heading: { gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  hero: {
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  section: {
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: spacing.md,
  },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  amount: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  status: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 11,
    fontWeight: '700',
  },
  pager: { gap: spacing.sm, alignItems: 'center' },
  downloadAction: { width: 84 },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { shareFile } from '../../core/files/share';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatTunisDate } from '../../shared/utils/format';
import type { Enrollment, Page } from '../payments/types';
import type { Certificate, FeedbackStatistics } from './types';

const ratings = [1, 2, 3, 4, 5] as const;
function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Une erreur inattendue est survenue.';
}

export function CertificatesScreen() {
  const { user, request, download } = useAuth();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [statistics, setStatistics] = useState<FeedbackStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const certificatePage = await request<Page<Certificate>>(
        '/certificates?page=1&pageSize=100',
      );
      setCertificates(certificatePage.items);
      if (user.role === 'LEARNER' || user.role === 'ADMIN') {
        setEnrollments(
          (await request<Page<Enrollment>>('/enrollments?page=1&pageSize=100'))
            .items,
        );
      }
      if (user.role === 'ADMIN')
        setStatistics(await request<FeedbackStatistics>('/feedback'));
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, user]);

  useEffect(() => {
    // Role selects authorized Certificates, eligibility and satisfaction data.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const certificateByEnrollment = useMemo(
    () =>
      new Map(
        certificates.map((certificate) => [
          certificate.enrollmentId,
          certificate,
        ]),
      ),
    [certificates],
  );

  async function generate(enrollmentId: string) {
    setBusy(`certificate:${enrollmentId}`);
    setError('');
    try {
      const certificate = await request<Certificate>('/certificates/generate', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId }),
      });
      setCertificates((current) => [
        certificate,
        ...current.filter(({ id }) => id !== certificate.id),
      ]);
      setNotice('Le certificat est prêt au téléchargement.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy('');
    }
  }

  async function rate(enrollmentId: string, rating: number) {
    setBusy(`feedback:${enrollmentId}`);
    setError('');
    try {
      const feedback = await request<{ rating: number; createdAt: string }>(
        '/feedback',
        {
          method: 'POST',
          body: JSON.stringify({ enrollmentId, rating }),
        },
      );
      setEnrollments((current) =>
        current.map((item) =>
          item.id === enrollmentId ? { ...item, feedback } : item,
        ),
      );
      setNotice('Merci, votre note de satisfaction a été enregistrée.');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy('');
    }
  }

  async function openCertificate(certificate: Certificate) {
    setBusy(`download:${certificate.id}`);
    setError('');
    try {
      await shareFile(
        await download(
          `/certificates/${certificate.id}/pdf`,
          `${certificate.number}.pdf`,
        ),
        'application/pdf',
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy('');
    }
  }

  if (user === null) return null;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && certificates.length > 0}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>ACHÈVEMENT VÉRIFIÉ PAR LE BACKEND</Text>
          <Text style={styles.title}>
            {user.role === 'ADMIN'
              ? 'Certificats & satisfaction'
              : user.role === 'TRAINER'
                ? 'Certificats de mes formations'
                : 'Mes certificats et avis'}
          </Text>
        </View>
        <Notice message={error} />
        <Notice message={notice} success />
        {loading && certificates.length === 0 && enrollments.length === 0 ? (
          <StatePanel
            loading
            message="Vérification des certificats et de l’éligibilité…"
          />
        ) : (
          <>
            {(user.role === 'LEARNER' || user.role === 'ADMIN') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {user.role === 'ADMIN'
                    ? 'Génération par inscription'
                    : 'Mes inscriptions'}
                </Text>
                {enrollments.length === 0 && (
                  <Text style={styles.muted}>
                    Aucune inscription confirmée.
                  </Text>
                )}
                {enrollments.map((enrollment) => {
                  const certificate = certificateByEnrollment.get(
                    enrollment.id,
                  );
                  return (
                    <View key={enrollment.id} style={styles.card}>
                      <Text style={styles.cardTitle}>
                        {enrollment.training.title}
                      </Text>
                      <Text style={styles.muted}>
                        {enrollment.session?.title ?? 'Formation en autonomie'}
                        {user.role === 'ADMIN'
                          ? ` · ${enrollment.learner.firstName ?? enrollment.learner.email}`
                          : ''}
                      </Text>
                      {certificate === undefined &&
                        enrollment.eligibility?.eligible === true && (
                          <Button
                            label="Générer le certificat"
                            loading={busy === `certificate:${enrollment.id}`}
                            onPress={() => void generate(enrollment.id)}
                          />
                        )}
                      {certificate !== undefined && (
                        <Button
                          label={`Ouvrir ${certificate.number}`}
                          loading={busy === `download:${certificate.id}`}
                          onPress={() => void openCertificate(certificate)}
                          variant="secondary"
                        />
                      )}
                      {certificate === undefined &&
                        enrollment.eligibility?.eligible === false && (
                          <Text style={styles.muted}>
                            Conditions restantes :{' '}
                            {enrollment.eligibility.failures.join(', ')}
                          </Text>
                        )}
                      {user.role === 'LEARNER' &&
                        enrollment.eligibility?.eligible === true &&
                        enrollment.feedback === undefined && (
                          <View style={styles.ratingRow}>
                            {ratings.map((rating) => (
                              <Pressable
                                key={rating}
                                accessibilityLabel={`${rating} étoile(s)`}
                                accessibilityRole="button"
                                disabled={busy !== ''}
                                onPress={() => void rate(enrollment.id, rating)}
                                style={styles.rating}
                              >
                                <Text style={styles.ratingText}>
                                  {rating} ★
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      {enrollment.feedback !== undefined && (
                        <Text style={styles.success}>
                          Votre note : {enrollment.feedback.rating}/5
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Certificats émis</Text>
              {certificates.length === 0 && (
                <Text style={styles.muted}>Aucun certificat émis.</Text>
              )}
              {certificates.map((certificate) => (
                <View key={certificate.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {certificate.training.title}
                  </Text>
                  <Text style={styles.muted}>
                    {certificate.number} ·{' '}
                    {formatTunisDate(certificate.issuedAt)}
                  </Text>
                  <Button
                    label="Ouvrir le PDF"
                    loading={busy === `download:${certificate.id}`}
                    onPress={() => void openCertificate(certificate)}
                    variant="secondary"
                  />
                </View>
              ))}
            </View>
            {user.role === 'ADMIN' && statistics !== null && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Satisfaction</Text>
                <Text style={styles.average}>
                  {statistics.global.average === null
                    ? '—'
                    : `${statistics.global.average.toFixed(1)}/5`}
                </Text>
                <Text style={styles.muted}>
                  {statistics.global.count} note(s)
                </Text>
                {ratings.map((rating) => (
                  <Text key={rating} style={styles.body}>
                    {rating} ★ :{' '}
                    {
                      statistics.global.distribution[
                        String(rating) as '1' | '2' | '3' | '4' | '5'
                      ]
                    }
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 40 },
  heading: { gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  title: { color: colors.ink, fontSize: 27, fontWeight: '700' },
  section: {
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  card: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  body: { color: colors.ink, fontSize: 14 },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rating: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.canvas,
  },
  ratingText: { color: '#9a650f', fontWeight: '700' },
  success: { color: colors.success, fontSize: 14, fontWeight: '700' },
  average: { color: colors.primaryDark, fontSize: 30, fontWeight: '800' },
});

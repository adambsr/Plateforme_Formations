import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppStackParamList } from '../../app/navigation/types';
import {
  trackRecommendationClick,
  trackRecommendationImpressions,
} from '../../core/analytics/recommendation-analytics';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatDuration, formatEur } from '../trainings/format';
import { apiAssetUrl } from '../../core/api/client';
import { formatTunisDate } from '../../shared/utils/format';

interface Page<T> {
  items: T[];
  total: number;
}
interface Named {
  id: string;
  title?: string;
  training?: { title: string; thumbnailUrl?: string };
  status?: string;
}
interface TrainerSessionSummary extends Named {
  startAt?: string;
  endAt?: string;
  location?: string;
  room?: string;
}
interface Progress {
  training: { title: string };
  percentage: number;
  isComplete: boolean;
}
interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: 'SELF_PACED_ONLINE' | 'IN_PERSON';
  level: string;
  durationMinutes: number;
  priceMinor: number;
  currency: 'EUR';
  categoryId: string;
  categoryName: string;
  thumbnailUrl?: string;
  reason: string;
}
interface Recommendations {
  strategy: 'HISTORY_AND_POPULARITY';
  recommendations: Recommendation[];
}

export function RoleDashboardSummary({
  navigation,
}: {
  navigation: NativeStackNavigationProp<AppStackParamList, 'Workspace'>;
}) {
  const { user, request } = useAuth();
  const [learner, setLearner] = useState<{
    progress: Page<Progress>;
    sessions: Page<Named>;
    payments: Page<Named>;
    certificates: Page<Named>;
    recommendations: Recommendations;
  }>();
  const [trainer, setTrainer] = useState<{
    trainings: Page<Named>;
    sessions: Page<TrainerSessionSummary>;
    evaluations: Page<Named>;
  }>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (user === null || user.role === 'ADMIN') return;
    setError('');
    try {
      if (user.role === 'LEARNER') {
        const [progress, sessions, payments, certificates, recommendations] =
          await Promise.all([
            request<Page<Progress>>('/progress?page=1&pageSize=5'),
            request<Page<Named>>('/sessions?view=ENROLLED&page=1&pageSize=5'),
            request<Page<Named>>('/payments?page=1&pageSize=5'),
            request<Page<Named>>('/certificates?page=1&pageSize=5'),
            request<Recommendations>('/dashboard/recommendations'),
          ]);
        setLearner({
          progress,
          sessions,
          payments,
          certificates,
          recommendations,
        });
        trackRecommendationImpressions(
          recommendations.recommendations.map((item, index) => ({
            trainingId: item.id,
            categoryName: item.categoryName,
            rank: index + 1,
          })),
        );
      } else {
        const [trainings, sessions, evaluations] = await Promise.all([
          request<Page<Named>>('/trainings?view=MANAGED&page=1&pageSize=5'),
          request<Page<TrainerSessionSummary>>('/sessions?view=MANAGED&page=1&pageSize=5'),
          request<Page<Named>>('/evaluations?view=MANAGED&page=1&pageSize=5'),
        ]);
        setTrainer({ trainings, sessions, evaluations });
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Impossible de charger votre tableau de bord.',
      );
    }
  }, [request, user]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  if (user === null || user.role === 'ADMIN') return null;
  if (error !== '')
    return <StatePanel message={error} retry={() => void load()} />;
  if (
    (user.role === 'LEARNER' && learner === undefined) ||
    (user.role === 'TRAINER' && trainer === undefined)
  )
    return (
      <StatePanel loading message="Chargement de votre tableau de bord…" />
    );

  if (user.role === 'TRAINER' && trainer !== undefined) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vue d’ensemble</Text>
        <View style={styles.metrics}>
          <Metric label="Formations gérées" value={trainer.trainings.total} />
          <Metric label="Sessions affectées" value={trainer.sessions.total} />
          <Metric label="Évaluations" value={trainer.evaluations.total} />
        </View>
        <Text style={styles.cardTitle}>Sessions récentes</Text>
        {trainer.sessions.items.length === 0 ? (
          <Text style={styles.muted}>
            Aucune session ne vous est encore affectée.
          </Text>
        ) : (
          trainer.sessions.items.map((item) => (
            <View key={item.id} style={styles.sessionCard}>
              {item.training?.thumbnailUrl !== undefined && (
                <Image source={{ uri: apiAssetUrl(item.training.thumbnailUrl) }} style={styles.sessionThumbnail} />
              )}
              <Text style={styles.cardTitle}>{item.training?.title ?? 'Formation'}</Text>
              <Text style={styles.muted}>{item.title ?? 'Session'}</Text>
              {item.startAt !== undefined && (
                <Text style={styles.muted}>
                  {formatTunisDate(item.startAt)}{item.endAt !== undefined ? ` au ${formatTunisDate(item.endAt)}` : ''}
                  {item.location !== undefined ? ` · ${item.location}` : ''}
                  {item.room !== undefined ? ` · ${item.room}` : ''}
                </Text>
              )}
              {item.status && <Text style={styles.sessionStatus}>{item.status}</Text>}
            </View>
          ))
        )}
      </View>
    );
  }

  if (learner === undefined) return null;
  const average =
    learner.progress.items.length === 0
      ? 0
      : Math.round(
          learner.progress.items.reduce(
            (sum, item) => sum + item.percentage,
            0,
          ) / learner.progress.items.length,
        );
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Votre parcours</Text>
      <View style={styles.metrics}>
        <Metric label="Formations actives" value={learner.progress.total} />
        <Metric label="Progression moyenne" value={`${average}%`} />
        <Metric label="Sessions à venir" value={learner.sessions.total} />
        <Metric label="Certificats" value={learner.certificates.total} />
      </View>
      <Text style={styles.sectionTitle}>
        Prochaines formations recommandées
      </Text>
      {learner.recommendations.recommendations.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Aucune nouvelle recommandation pour le moment. Explorez le catalogue
            pour découvrir d’autres parcours.
          </Text>
          <Button
            label="Explorer le catalogue"
            variant="secondary"
            onPress={() => navigation.navigate('Catalogue')}
          />
        </View>
      ) : (
        learner.recommendations.recommendations.map((item, index) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            style={styles.card}
            onPress={() => {
              void trackRecommendationClick({
                trainingId: item.id,
                categoryName: item.categoryName,
                rank: index + 1,
              });
              navigation.navigate('TrainingDetail', { trainingId: item.id });
            }}
          >
            <Text style={styles.eyebrow}>{item.categoryName}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.muted}>{item.description}</Text>
            <Text style={styles.reason}>{item.reason}</Text>
            <Text style={styles.meta}>
              {formatDuration(item.durationMinutes)} ·{' '}
              {formatEur(item.priceMinor)}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: {
    minWidth: '46%',
    flexGrow: 1,
    gap: spacing.xs,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  metricLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  reason: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  row: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  sessionCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  sessionThumbnail: { width: '100%', height: 96, borderRadius: radii.sm },
  sessionStatus: { color: colors.primaryDark, fontSize: 12, fontWeight: '700' },
});

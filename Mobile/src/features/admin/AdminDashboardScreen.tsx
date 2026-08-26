import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type {
  Overview,
  Participation,
  Profitability,
  ProgressDashboard,
  Satisfaction,
} from './types';

type DashboardData = {
  overview: Overview;
  participation: Participation;
  progress: ProgressDashboard;
  satisfaction: Satisfaction;
  profitability: Profitability;
};

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Impossible de charger le tableau de bord.';
}

function calendarDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

function percent(value: number | null) {
  return value === null ? 'Données insuffisantes' : `${value}%`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function AdminDashboardScreen() {
  const { user, request } = useAuth();
  const initial = useMemo(() => {
    const now = new Date();
    return { from: `${now.getFullYear()}-01-01`, to: calendarDate(now) };
  }, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [appliedRange, setAppliedRange] = useState(initial);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    const query = `from=${appliedRange.from}&to=${appliedRange.to}`;
    try {
      const [overview, participation, progress, satisfaction, profitability] =
        await Promise.all([
          request<Overview>(`/dashboard/overview?${query}`),
          request<Participation>(`/dashboard/participation?${query}`),
          request<ProgressDashboard>(`/dashboard/progress?${query}`),
          request<Satisfaction>(`/dashboard/satisfaction?${query}`),
          request<Profitability>(`/dashboard/profitability?${query}`),
        ]);
      setData({
        overview,
        participation,
        progress,
        satisfaction,
        profitability,
      });
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [appliedRange, request, user?.role]);

  useEffect(() => {
    // The selected calendar range drives backend-calculated KPIs.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  if (user?.role !== 'ADMIN') return null;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && data !== null}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>PILOTAGE DU CENTRE</Text>
          <Text style={styles.title}>Tableau de bord</Text>
          <Text style={styles.muted}>
            Tous les calculs financiers et pédagogiques proviennent du backend.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Période</Text>
          <TextField
            autoCapitalize="none"
            label="Du (AAAA-MM-JJ)"
            onChangeText={setFrom}
            value={from}
          />
          <TextField
            autoCapitalize="none"
            label="Au (AAAA-MM-JJ)"
            onChangeText={setTo}
            value={to}
          />
          <Button
            label="Actualiser les indicateurs"
            onPress={() => {
              if (
                /^\d{4}-\d{2}-\d{2}$/.test(from) &&
                /^\d{4}-\d{2}-\d{2}$/.test(to) &&
                from <= to
              ) {
                setAppliedRange({ from, to });
              } else {
                setError('Saisissez une période valide au format AAAA-MM-JJ.');
              }
            }}
          />
        </View>
        <Notice message={error} />
        {loading && data === null ? (
          <StatePanel loading message="Calcul des indicateurs…" />
        ) : data !== null ? (
          <>
            <View style={styles.metricGrid}>
              <Metric
                label="Formations"
                value={data.overview.counts.trainings}
              />
              <Metric label="Sessions" value={data.overview.counts.sessions} />
              <Metric
                label="Apprenants"
                value={data.overview.counts.learners}
              />
              <Metric
                label="Formateurs"
                value={data.overview.counts.trainers}
              />
              <Metric
                label="Inscriptions"
                value={data.overview.counts.enrollments}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Participation</Text>
              <Text style={styles.highlight}>
                {percent(data.participation.overall.participationPercent)}
              </Text>
              <Text style={styles.muted}>
                {data.participation.overall.present} présence(s) sur{' '}
                {data.participation.overall.expected} attendue(s),{' '}
                {data.participation.overall.recorded} saisie(s).
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Apprentissage</Text>
              <Metric
                label="Progression moyenne"
                value={percent(data.progress.selfPaced.averagePercentage)}
              />
              <Metric
                label="Réussite aux évaluations"
                value={percent(data.progress.evaluations.passPercent)}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Satisfaction</Text>
              <Text style={styles.highlight}>
                {data.satisfaction.global.average === null
                  ? 'Aucun avis'
                  : `${data.satisfaction.global.average}/5`}
              </Text>
              <Text style={styles.muted}>
                {data.satisfaction.global.count} avis
              </Text>
              <View style={styles.distribution}>
                {Object.entries(data.satisfaction.global.distribution).map(
                  ([rating, count]) => (
                    <Text key={rating} style={styles.muted}>
                      {rating} ★ : {count}
                    </Text>
                  ),
                )}
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rentabilité</Text>
              <Metric
                label="Revenus payés"
                value={money(data.profitability.revenueMinor)}
              />
              <Metric
                label="Coûts formateurs"
                value={money(data.profitability.trainerCostsMinor)}
              />
              <Metric
                label="Dépenses formations"
                value={money(data.profitability.trainingCostsMinor)}
              />
              <Metric
                label="Résultat global"
                value={money(data.profitability.resultMinor)}
              />
              <Text style={styles.highlight}>
                {percent(data.profitability.profitabilityPercent)}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Résultat par formation</Text>
              {data.profitability.byTraining.length === 0 ? (
                <Text style={styles.muted}>
                  Aucun mouvement sur la période.
                </Text>
              ) : (
                data.profitability.byTraining.map((row) => (
                  <View key={row.training.id} style={styles.resultRow}>
                    <Text style={styles.resultTitle}>{row.training.title}</Text>
                    <Text style={styles.resultMoney}>
                      {money(row.resultBeforeFixedTrainerCostsMinor)}
                    </Text>
                    <Text style={styles.muted}>
                      Avant coûts fixes formateurs
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.xl },
  heading: { gap: spacing.sm },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: {
    minWidth: '45%',
    flexGrow: 1,
    gap: spacing.xs,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  metricLabel: { color: colors.primaryDark, fontSize: 13, fontWeight: '600' },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  highlight: { color: colors.primaryDark, fontSize: 24, fontWeight: '800' },
  distribution: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  resultRow: {
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  resultTitle: { color: colors.ink, fontWeight: '700' },
  resultMoney: { color: colors.success, fontSize: 18, fontWeight: '800' },
});

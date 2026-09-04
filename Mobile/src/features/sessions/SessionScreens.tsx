import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError, apiClient } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import {
  formatTunisDate,
  formatTunisDateTime,
} from '../../shared/utils/format';
import type {
  PaginatedSessions,
  SessionStatus,
  SessionTrainer,
  TrainingSession,
} from './types';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function sessionStatusLabel(status: SessionStatus): string {
  return {
    PLANNED: 'Planifiée',
    IN_PROGRESS: 'En cours',
    COMPLETED: 'Terminée',
    CANCELLED: 'Annulée',
  }[status];
}

function trainerName(trainer: SessionTrainer): string {
  return (
    [trainer.firstName, trainer.lastName].filter(Boolean).join(' ') ||
    'Formateur du centre'
  );
}

function SessionCard({
  session,
  onPress,
  onPurchase,
  purchasing,
}: {
  session: TrainingSession;
  onPress?: () => void;
  onPurchase?: () => void;
  purchasing?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      disabled={onPress === undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeading}>
        <Text style={styles.status}>{sessionStatusLabel(session.status)}</Text>
        <Text style={styles.seats}>{session.availableSeats} place(s)</Text>
      </View>
      <Text style={styles.cardTitle}>{session.title}</Text>
      <Text style={styles.muted}>{session.training.title}</Text>
      <Text style={styles.body}>
        {session.location}
        {session.room === undefined ? '' : ` · ${session.room}`}
      </Text>
      <Text style={styles.muted}>
        {session.startAt === undefined
          ? 'Dates à confirmer'
          : `Du ${formatTunisDate(session.startAt)} au ${formatTunisDate(
              session.endAt ?? session.startAt,
            )}`}
      </Text>
      {onPurchase !== undefined && (
        <Button
          label="Choisir cette session"
          loading={purchasing}
          onPress={onPurchase}
        />
      )}
    </Pressable>
  );
}

export function PublicSessions({
  trainingId,
  onPurchase,
  purchasingSessionId,
}: {
  trainingId: string;
  onPurchase?: (sessionId: string) => void;
  purchasingSessionId?: string;
}) {
  const [page, setPage] = useState<PaginatedSessions | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPage(
        await apiClient.request<PaginatedSessions>(
          `/sessions?view=PUBLIC&trainingId=${trainingId}&page=${pageNumber}&pageSize=6`,
        ),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, trainingId]);

  useEffect(() => {
    // Public session availability comes from the shared API.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sessions disponibles</Text>
      {loading && page === null ? (
        <StatePanel loading message="Chargement des sessions…" />
      ) : error !== '' ? (
        <StatePanel message={error} retry={() => void load()} />
      ) : page === null || page.items.length === 0 ? (
        <Text style={styles.muted}>
          Aucune session planifiée avec des places disponibles.
        </Text>
      ) : (
        <>
          {page.items.map((session) => (
            <SessionCard
              key={session.id}
              onPurchase={
                onPurchase === undefined
                  ? undefined
                  : () => onPurchase(session.id)
              }
              purchasing={purchasingSessionId === session.id}
              session={session}
            />
          ))}
          <Button
            disabled={page.page <= 1}
            label="Sessions précédentes"
            onPress={() => setPageNumber((value) => value - 1)}
            variant="secondary"
          />
          <Button
            disabled={page.page * page.pageSize >= page.total}
            label="Sessions suivantes"
            onPress={() => setPageNumber((value) => value + 1)}
            variant="secondary"
          />
        </>
      )}
    </View>
  );
}

export function SessionsScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Sessions'>) {
  const { user, request } = useAuth();
  const [page, setPage] = useState<PaginatedSessions | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const view = user.role === 'LEARNER' ? 'ENROLLED' : 'MANAGED';
      const result = await request<PaginatedSessions>(
        `/sessions?view=${view}&page=${pageNumber}&pageSize=12`,
      );
      setPage(
        user.role === 'TRAINER'
          ? {
              ...result,
              items: result.items.filter((session) =>
                session.assignedTrainers.some(({ id }) => id === user.id),
              ),
            }
          : result,
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, request, user]);

  useEffect(() => {
    // Role and page select the authorized Session collection.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && page !== null}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>PRÉSENTIEL</Text>
          <Text style={styles.title}>
            {user?.role === 'LEARNER' ? 'Mon planning' : 'Mes sessions'}
          </Text>
        </View>
        {user !== null && user.role !== 'LEARNER' && (
          <Button
            label="Créer une Session"
            onPress={() => navigation.navigate('SessionManage')}
          />
        )}
        {loading && page === null ? (
          <StatePanel loading message="Chargement des sessions…" />
        ) : error !== '' ? (
          <StatePanel message={error} retry={() => void load()} />
        ) : page === null || page.items.length === 0 ? (
          <StatePanel
            title="Aucune session concernée"
            message={
              user?.role === 'LEARNER'
                ? 'Votre planning apparaîtra après confirmation du paiement.'
                : 'Les sessions qui vous concernent apparaîtront ici.'
            }
          />
        ) : (
          <>
            {page.items.map((session) => (
              <View key={session.id} style={styles.section}>
                <SessionCard
                  onPress={() =>
                    navigation.navigate('SessionDetail', {
                      sessionId: session.id,
                    })
                  }
                  session={session}
                />
                {user !== null && user.role !== 'LEARNER' && session.status !== 'COMPLETED' && (
                  <Button
                    label="Gérer cette Session"
                    onPress={() =>
                      navigation.navigate('SessionManage', {
                        sessionId: session.id,
                      })
                    }
                    variant="secondary"
                  />
                )}
                {session.status === 'COMPLETED' && (
                  <Text style={styles.completedNotice}>
                    Session terminée : la gestion n’est plus disponible.
                  </Text>
                )}
              </View>
            ))}
            <Button
              disabled={page.page <= 1}
              label="Page précédente"
              onPress={() => setPageNumber((value) => value - 1)}
              variant="secondary"
            />
            <Text style={styles.pageText}>Page {page.page}</Text>
            <Button
              disabled={page.page * page.pageSize >= page.total}
              label="Page suivante"
              onPress={() => setPageNumber((value) => value + 1)}
              variant="secondary"
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SessionDetailScreen({
  route,
}: NativeStackScreenProps<AppStackParamList, 'SessionDetail'>) {
  const { request } = useAuth();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { sessionId } = route.params;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSession(await request<TrainingSession>(`/sessions/${sessionId}`));
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, sessionId]);

  useEffect(() => {
    // Route entry loads the authorized Session detail.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading && session === null ? (
          <StatePanel loading message="Chargement de la session…" />
        ) : error !== '' || session === null ? (
          <StatePanel
            message={error || 'Session introuvable.'}
            retry={() => void load()}
          />
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.status}>
                {sessionStatusLabel(session.status)}
              </Text>
              <Text style={styles.title}>{session.title}</Text>
              <Text style={styles.body}>{session.training.title}</Text>
              <Text style={styles.muted}>
                {session.location} · {session.address}
                {session.room === undefined ? '' : ` · ${session.room}`}
              </Text>
              <Text style={styles.seats}>
                {session.enrolledCount}/{session.capacity} inscription(s)
              </Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Planning</Text>
              {session.schedules.length === 0 ? (
                <Text style={styles.muted}>Aucune date planifiée.</Text>
              ) : (
                session.schedules.map((schedule, index) => (
                  <View key={schedule.id} style={styles.schedule}>
                    <Text style={styles.scheduleNumber}>
                      SÉANCE {index + 1}
                    </Text>
                    <Text style={styles.cardTitle}>
                      {formatTunisDateTime(schedule.startAt)}
                    </Text>
                    <Text style={styles.muted}>
                      Fin : {formatTunisDateTime(schedule.endAt)}
                    </Text>
                    <Text style={styles.body}>
                      {schedule.location ?? session.location}
                      {(schedule.room ?? session.room) === undefined
                        ? ''
                        : ` · ${schedule.room ?? session.room}`}
                    </Text>
                    <Text style={styles.muted}>
                      {schedule.trainers.map(trainerName).join(', ') ||
                        'Formateur à confirmer'}
                    </Text>
                  </View>
                ))
              )}
            </View>
            {session.additionalInformation !== '' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Informations</Text>
                <Text style={styles.body}>{session.additionalInformation}</Text>
              </View>
            )}
          </>
        )}
        <Notice message={error} />
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.8 },
  cardHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  status: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '700',
  },
  seats: { color: colors.success, fontSize: 13, fontWeight: '700' },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  pageText: { color: colors.muted, textAlign: 'center' },
  completedNotice: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  hero: {
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  schedule: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  scheduleNumber: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});

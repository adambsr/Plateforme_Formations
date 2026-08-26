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

import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatTunisDateTime } from '../../shared/utils/format';
import type {
  AttendanceSessionPage,
  AttendanceStatus,
  SessionAttendance,
} from './types';

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function learnerName(learner: SessionAttendance['roster'][number]['learner']) {
  return (
    [learner.firstName, learner.lastName].filter(Boolean).join(' ') ||
    learner.email
  );
}

function statusLabel(status: AttendanceStatus | null) {
  if (status === 'PRESENT') return 'Présent';
  if (status === 'ABSENT') return 'Absent';
  return 'Non saisie';
}

export function AttendanceScreen() {
  const { user, request } = useAuth();
  const [sessions, setSessions] = useState<AttendanceSessionPage | null>(null);
  const [selected, setSelected] = useState<SessionAttendance | null>(null);
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus>>({});
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingScheduleId, setSavingScheduleId] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDetail = useCallback(
    async (sessionId: string) => {
      const detail = await request<SessionAttendance>(
        `/sessions/${sessionId}/attendance`,
      );
      setSelected(detail);
      const initial: Record<string, AttendanceStatus> = {};
      detail.roster.forEach((row) =>
        row.records.forEach((record) => {
          if (record.status !== null) {
            initial[`${record.scheduleId}:${row.enrollmentId}`] = record.status;
          }
        }),
      );
      setDrafts(initial);
    },
    [request],
  );

  const load = useCallback(async () => {
    if (user === null) return;
    setLoading(true);
    setError('');
    try {
      const view = user.role === 'LEARNER' ? 'ENROLLED' : 'MANAGED';
      const result = await request<AttendanceSessionPage>(
        `/sessions?view=${view}&page=${pageNumber}&pageSize=12`,
      );
      const items =
        user.role === 'TRAINER'
          ? result.items.filter((session) =>
              session.assignedTrainers.some(({ id }) => id === user.id),
            )
          : result.items;
      const next = { ...result, items };
      setSessions(next);
      const current = items.find(({ id }) => id === selected?.session.id);
      if (current !== undefined) await loadDetail(current.id);
      else if (items[0] !== undefined) await loadDetail(items[0].id);
      else setSelected(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [loadDetail, pageNumber, request, selected?.session.id, user]);

  useEffect(() => {
    // The authorized session collection and attendance sheets come from the API.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function selectSession(sessionId: string) {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await loadDetail(sessionId);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule(scheduleId: string) {
    if (selected === null) return;
    const entries = selected.roster.map(({ enrollmentId }) => ({
      enrollmentId,
      status: drafts[`${scheduleId}:${enrollmentId}`],
    }));
    if (entries.some(({ status }) => status === undefined)) {
      setError('Renseignez la présence de chaque apprenant pour cette date.');
      return;
    }
    setSavingScheduleId(scheduleId);
    setError('');
    setNotice('');
    try {
      const updated = await request<SessionAttendance>(
        `/schedules/${scheduleId}/attendance`,
        {
          method: 'PUT',
          body: JSON.stringify({ entries }),
        },
      );
      setSelected(updated);
      setNotice('Présences enregistrées.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingScheduleId(undefined);
    }
  }

  if (user === null) return null;
  const staff = user.role !== 'LEARNER';
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && sessions !== null}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>PRÉSENTIEL</Text>
          <Text style={styles.title}>
            {staff ? 'Gestion des présences' : 'Mon planning'}
          </Text>
        </View>
        <Notice message={error} />
        <Notice message={notice} success />
        {loading && sessions === null ? (
          <StatePanel loading message="Chargement des présences…" />
        ) : sessions === null || sessions.items.length === 0 ? (
          <StatePanel
            title="Aucune session concernée"
            message={
              staff
                ? 'Les sessions auxquelles vous êtes affecté apparaîtront ici.'
                : 'Votre planning apparaîtra après confirmation du paiement.'
            }
          />
        ) : (
          <>
            <ScrollView
              horizontal
              contentContainerStyle={styles.tabs}
              showsHorizontalScrollIndicator={false}
            >
              {sessions.items.map((session) => (
                <Pressable
                  accessibilityRole="button"
                  key={session.id}
                  onPress={() => void selectSession(session.id)}
                  style={[
                    styles.tab,
                    selected?.session.id === session.id && styles.tabSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabText,
                      selected?.session.id === session.id &&
                        styles.tabTextSelected,
                    ]}
                  >
                    {session.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.pagination}>
              <Button
                disabled={sessions.page <= 1}
                label="Précédente"
                onPress={() => setPageNumber((value) => value - 1)}
                variant="secondary"
              />
              <Text style={styles.muted}>Page {sessions.page}</Text>
              <Button
                disabled={sessions.page * sessions.pageSize >= sessions.total}
                label="Suivante"
                onPress={() => setPageNumber((value) => value + 1)}
                variant="secondary"
              />
            </View>
            {selected !== null && (
              <View style={styles.section}>
                <View style={styles.summary}>
                  <Text style={styles.sectionTitle}>
                    {selected.session.training.title}
                  </Text>
                  <Text style={styles.body}>{selected.session.title}</Text>
                  <Text style={styles.threshold}>
                    Seuil requis : {selected.minimumAttendancePercent}%
                  </Text>
                  {selected.immutable && (
                    <Text style={styles.muted}>
                      Présences immuables depuis la fin de la session.
                    </Text>
                  )}
                </View>
                {selected.schedules.length === 0 ? (
                  <StatePanel message="Aucune date planifiée." />
                ) : staff ? (
                  selected.schedules.map((schedule) => (
                    <View key={schedule.id} style={styles.card}>
                      <Text style={styles.cardTitle}>
                        {formatTunisDateTime(schedule.startAt)}
                      </Text>
                      <Text style={styles.muted}>
                        {schedule.location}
                        {schedule.room === undefined
                          ? ''
                          : ` · ${schedule.room}`}
                      </Text>
                      {selected.roster.length === 0 ? (
                        <Text style={styles.muted}>
                          Aucun apprenant inscrit.
                        </Text>
                      ) : (
                        selected.roster.map((row) => {
                          const key = `${schedule.id}:${row.enrollmentId}`;
                          const value = drafts[key];
                          return (
                            <View
                              key={row.enrollmentId}
                              style={styles.rosterRow}
                            >
                              <View style={styles.flex}>
                                <Text style={styles.learnerName}>
                                  {learnerName(row.learner)}
                                </Text>
                                <Text style={styles.muted}>
                                  {row.learner.email}
                                </Text>
                              </View>
                              <View style={styles.choiceRow}>
                                {(['PRESENT', 'ABSENT'] as const).map(
                                  (status) => (
                                    <Pressable
                                      accessibilityRole="radio"
                                      accessibilityState={{
                                        checked: value === status,
                                        disabled: !selected.canRecord,
                                      }}
                                      disabled={!selected.canRecord}
                                      key={status}
                                      onPress={() =>
                                        setDrafts((current) => ({
                                          ...current,
                                          [key]: status,
                                        }))
                                      }
                                      style={[
                                        styles.choice,
                                        value === status &&
                                          styles.choiceSelected,
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.choiceText,
                                          value === status &&
                                            styles.choiceTextSelected,
                                        ]}
                                      >
                                        {statusLabel(status)}
                                      </Text>
                                    </Pressable>
                                  ),
                                )}
                              </View>
                            </View>
                          );
                        })
                      )}
                      {selected.canRecord && selected.roster.length > 0 && (
                        <Button
                          label="Enregistrer cette date"
                          loading={savingScheduleId === schedule.id}
                          onPress={() => void saveSchedule(schedule.id)}
                        />
                      )}
                    </View>
                  ))
                ) : (
                  <>
                    {selected.schedules.map((schedule) => {
                      const record = selected.roster[0]?.records.find(
                        ({ scheduleId }) => scheduleId === schedule.id,
                      );
                      return (
                        <View key={schedule.id} style={styles.card}>
                          <Text style={styles.cardTitle}>
                            {formatTunisDateTime(schedule.startAt)}
                          </Text>
                          <Text style={styles.body}>
                            {schedule.location}
                            {schedule.room === undefined
                              ? ''
                              : ` · ${schedule.room}`}
                          </Text>
                          <Text style={styles.status}>
                            {statusLabel(record?.status ?? null)}
                          </Text>
                        </View>
                      );
                    })}
                    {selected.roster[0] !== undefined && (
                      <View style={styles.summary}>
                        <Text style={styles.sectionTitle}>
                          Présence : {selected.roster[0].attendancePercentage}%
                        </Text>
                        <Text style={styles.muted}>
                          {selected.roster[0].presentCount}/
                          {selected.roster[0].totalScheduleCount} date(s)
                          présente(s)
                        </Text>
                        {!selected.roster[0].attendanceCoverageComplete && (
                          <Text style={styles.body}>
                            Des présences n’ont pas encore été saisies.
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                )}
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
  content: { gap: spacing.lg, padding: spacing.xl },
  heading: { gap: spacing.xs },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  tabs: { gap: spacing.sm },
  tab: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  tabSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText: { color: colors.ink, fontWeight: '700' },
  tabTextSelected: { color: colors.surface },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  section: { gap: spacing.lg },
  summary: {
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
  },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  threshold: { color: colors.primaryDark, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  rosterRow: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  flex: { flex: 1, gap: spacing.xs },
  learnerName: { color: colors.ink, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: { color: colors.muted, fontWeight: '700' },
  choiceTextSelected: { color: colors.primaryDark },
  status: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontWeight: '800',
  },
});

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { formatTunisDateTime } from '../../shared/utils/format';
import type { Page } from '../admin/types';
import type { Training } from '../trainings/types';
import type { SessionSchedule, SessionTrainer, TrainingSession } from './types';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function trainerName(trainer: SessionTrainer) {
  return (
    [trainer.firstName, trainer.lastName].filter(Boolean).join(' ') ||
    'Formateur'
  );
}

function Toggle({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function toggleId(values: string[], id: string) {
  return values.includes(id)
    ? values.filter((value) => value !== id)
    : [...values, id];
}

export function SessionManagementScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, 'SessionManage'>) {
  const { user, request } = useAuth();
  const sessionId = route.params?.sessionId;
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainers, setTrainers] = useState<SessionTrainer[]>([]);
  const [trainingId, setTrainingId] = useState('');
  const [title, setTitle] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [capacity, setCapacity] = useState('');
  const [assignedTrainerIds, setAssignedTrainerIds] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [room, setRoom] = useState('');
  const [additionalInformation, setAdditionalInformation] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState<string>();
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [scheduleTrainerIds, setScheduleTrainerIds] = useState<string[]>([]);
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleAddress, setScheduleAddress] = useState('');
  const [scheduleRoom, setScheduleRoom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user === null || user.role === 'LEARNER') return;
    setLoading(true);
    setError('');
    try {
      const [trainingPage, trainerList, detail] = await Promise.all([
        request<Page<Training>>('/trainings?view=MANAGED&pageSize=100'),
        request<SessionTrainer[]>('/session-trainers'),
        sessionId === undefined
          ? Promise.resolve(undefined)
          : request<TrainingSession>(`/sessions/${sessionId}`),
      ]);
      setTrainings(
        trainingPage.items.filter(({ type }) => type === 'IN_PERSON'),
      );
      setTrainers(trainerList);
      if (detail !== undefined) {
        setSession(detail);
        setTrainingId(detail.training.id);
        setTitle(detail.title);
        setIdentifier(detail.identifier ?? '');
        setCapacity(String(detail.capacity));
        setAssignedTrainerIds(detail.assignedTrainers.map(({ id }) => id));
        setLocation(detail.location);
        setAddress(detail.address);
        setRoom(detail.room ?? '');
        setAdditionalInformation(detail.additionalInformation);
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, sessionId, user]);

  useEffect(() => {
    // Management options and the selected Session are backend-authorized.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function saveSession() {
    const numericCapacity = Number(capacity);
    if (
      (sessionId === undefined && trainingId === '') ||
      title.trim() === '' ||
      location.trim() === '' ||
      !Number.isInteger(numericCapacity) ||
      numericCapacity <= 0
    ) {
      setError('Renseignez la Formation, le titre, la capacité et le lieu.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const common = {
        title: title.trim(),
        capacity: numericCapacity,
        location: location.trim(),
        address: address.trim(),
        additionalInformation: additionalInformation.trim(),
        ...(identifier.trim() === ''
          ? { identifier: null }
          : { identifier: identifier.trim() }),
        ...(room.trim() === '' ? { room: null } : { room: room.trim() }),
      };
      const saved = await request<TrainingSession>(
        sessionId === undefined ? '/sessions' : `/sessions/${sessionId}`,
        {
          method: sessionId === undefined ? 'POST' : 'PUT',
          body: JSON.stringify(
            sessionId === undefined
              ? {
                  ...common,
                  identifier: identifier.trim() || undefined,
                  room: room.trim() || undefined,
                  trainingId,
                  ...(assignedTrainerIds.length === 0
                    ? {}
                    : { assignedTrainerIds }),
                }
              : common,
          ),
        },
      );
      if (sessionId !== undefined && assignedTrainerIds.length > 0) {
        await request(`/sessions/${sessionId}/trainers`, {
          method: 'PUT',
          body: JSON.stringify({ assignedTrainerIds }),
        });
      }
      if (sessionId === undefined) {
        navigation.replace('SessionManage', { sessionId: saved.id });
      } else {
        setNotice('Session mise à jour.');
        await load();
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  function resetSchedule() {
    setEditingScheduleId(undefined);
    setStartAt('');
    setEndAt('');
    setScheduleTrainerIds(assignedTrainerIds);
    setScheduleLocation('');
    setScheduleAddress('');
    setScheduleRoom('');
  }

  function editSchedule(schedule: SessionSchedule) {
    setEditingScheduleId(schedule.id);
    setStartAt(schedule.startAt);
    setEndAt(schedule.endAt);
    setScheduleTrainerIds(schedule.trainers.map(({ id }) => id));
    setScheduleLocation(schedule.location ?? '');
    setScheduleAddress(schedule.address ?? '');
    setScheduleRoom(schedule.room ?? '');
  }

  async function saveSchedule() {
    if (
      sessionId === undefined ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(startAt) ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(endAt) ||
      Number.isNaN(Date.parse(startAt)) ||
      Date.parse(startAt) >= Date.parse(endAt) ||
      scheduleTrainerIds.length === 0
    ) {
      setError(
        'Saisissez des instants ISO avec décalage, une fin ultérieure et au moins un Formateur.',
      );
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(
        editingScheduleId === undefined
          ? `/sessions/${sessionId}/schedules`
          : `/schedules/${editingScheduleId}`,
        {
          method: editingScheduleId === undefined ? 'POST' : 'PUT',
          body: JSON.stringify({
            startAt,
            endAt,
            trainerIds: scheduleTrainerIds,
            ...(scheduleLocation.trim() === ''
              ? {}
              : { location: scheduleLocation.trim() }),
            ...(scheduleAddress.trim() === ''
              ? {}
              : { address: scheduleAddress.trim() }),
            ...(scheduleRoom.trim() === ''
              ? {}
              : { room: scheduleRoom.trim() }),
          }),
        },
      );
      resetSchedule();
      setNotice('Planning enregistré.');
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  async function transition(action: 'start' | 'complete' | 'cancel') {
    if (sessionId === undefined) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(`/sessions/${sessionId}/${action}`, { method: 'POST' });
      setNotice('Statut de la Session mis à jour.');
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  function removeSchedule(schedule: SessionSchedule) {
    Alert.alert('Supprimer la séance', formatTunisDateTime(schedule.startAt), [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void request(`/schedules/${schedule.id}`, { method: 'DELETE' })
            .then(load)
            .catch((caught: unknown) => setError(message(caught)))
            .finally(() => setSaving(false));
        },
      },
    ]);
  }

  if (user === null || user.role === 'LEARNER') return null;
  if (loading && sessionId !== undefined && session === null) {
    return <StatePanel loading message="Chargement de la Session…" />;
  }
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>PRÉSENTIEL</Text>
          <Text style={styles.title}>
            {sessionId === undefined ? 'Créer une Session' : 'Gérer la Session'}
          </Text>
        </View>
        <Notice message={error} />
        <Notice message={notice} success />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations</Text>
          {sessionId === undefined && (
            <>
              <Text style={styles.label}>Formation présentielle</Text>
              <View style={styles.options}>
                {trainings.map((training) => (
                  <Toggle
                    key={training.id}
                    label={training.title}
                    onPress={() => setTrainingId(training.id)}
                    selected={trainingId === training.id}
                  />
                ))}
              </View>
            </>
          )}
          <TextField label="Titre" onChangeText={setTitle} value={title} />
          <TextField
            label="Identifiant facultatif"
            onChangeText={setIdentifier}
            value={identifier}
          />
          <TextField
            inputMode="numeric"
            label="Capacité"
            onChangeText={setCapacity}
            value={capacity}
          />
          <TextField label="Lieu" onChangeText={setLocation} value={location} />
          <TextField
            label="Adresse"
            onChangeText={setAddress}
            value={address}
          />
          <TextField
            label="Salle facultative"
            onChangeText={setRoom}
            value={room}
          />
          <TextField
            label="Informations complémentaires"
            multiline
            onChangeText={setAdditionalInformation}
            value={additionalInformation}
          />
          <Text style={styles.label}>Formateurs affectés</Text>
          <View style={styles.options}>
            {trainers.map((trainer) => (
              <Toggle
                key={trainer.id}
                label={trainerName(trainer)}
                onPress={() =>
                  setAssignedTrainerIds((current) =>
                    toggleId(current, trainer.id),
                  )
                }
                selected={assignedTrainerIds.includes(trainer.id)}
              />
            ))}
          </View>
          <Button
            label={
              sessionId === undefined
                ? 'Créer la Session'
                : 'Enregistrer la Session'
            }
            loading={saving}
            onPress={() => void saveSession()}
          />
        </View>
        {session !== null && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Cycle de vie · {session.status}
              </Text>
              {session.status === 'PLANNED' && (
                <Button
                  disabled={saving}
                  label="Démarrer"
                  onPress={() => void transition('start')}
                />
              )}
              {session.status === 'IN_PROGRESS' && (
                <Button
                  disabled={saving}
                  label="Terminer"
                  onPress={() => void transition('complete')}
                />
              )}
              {(session.status === 'PLANNED' ||
                session.status === 'IN_PROGRESS') && (
                <Button
                  disabled={saving}
                  label="Annuler la Session"
                  onPress={() => void transition('cancel')}
                  variant="danger"
                />
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {editingScheduleId === undefined
                  ? 'Ajouter une séance'
                  : 'Modifier la séance'}
              </Text>
              <Text style={styles.muted}>
                Utilisez un instant ISO avec décalage, par exemple
                2026-09-01T09:00:00+01:00 (heure de Tunis).
              </Text>
              <TextField
                autoCapitalize="none"
                label="Début ISO"
                onChangeText={setStartAt}
                value={startAt}
              />
              <TextField
                autoCapitalize="none"
                label="Fin ISO"
                onChangeText={setEndAt}
                value={endAt}
              />
              <Text style={styles.label}>Formateurs de cette séance</Text>
              <View style={styles.options}>
                {trainers
                  .filter(({ id }) => assignedTrainerIds.includes(id))
                  .map((trainer) => (
                    <Toggle
                      key={trainer.id}
                      label={trainerName(trainer)}
                      onPress={() =>
                        setScheduleTrainerIds((current) =>
                          toggleId(current, trainer.id),
                        )
                      }
                      selected={scheduleTrainerIds.includes(trainer.id)}
                    />
                  ))}
              </View>
              <TextField
                label="Lieu spécifique facultatif"
                onChangeText={setScheduleLocation}
                value={scheduleLocation}
              />
              <TextField
                label="Adresse spécifique facultative"
                onChangeText={setScheduleAddress}
                value={scheduleAddress}
              />
              <TextField
                label="Salle spécifique facultative"
                onChangeText={setScheduleRoom}
                value={scheduleRoom}
              />
              <Button
                label={
                  editingScheduleId === undefined
                    ? 'Ajouter au planning'
                    : 'Mettre à jour la séance'
                }
                loading={saving}
                onPress={() => void saveSchedule()}
              />
              {editingScheduleId !== undefined && (
                <Button
                  label="Annuler la modification"
                  onPress={resetSchedule}
                  variant="secondary"
                />
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Planning actuel</Text>
              {session.schedules.length === 0 ? (
                <Text style={styles.muted}>Aucune séance planifiée.</Text>
              ) : (
                session.schedules.map((schedule) => (
                  <View key={schedule.id} style={styles.schedule}>
                    <Text style={styles.rowTitle}>
                      {formatTunisDateTime(schedule.startAt)}
                    </Text>
                    <Text style={styles.muted}>
                      Fin : {formatTunisDateTime(schedule.endAt)}
                    </Text>
                    <Text style={styles.muted}>
                      {schedule.trainers.map(trainerName).join(', ')}
                    </Text>
                    <Button
                      label="Modifier"
                      onPress={() => editSchedule(schedule)}
                      variant="secondary"
                    />
                    <Button
                      disabled={saving}
                      label="Supprimer"
                      onPress={() => removeSchedule(schedule)}
                      variant="danger"
                    />
                  </View>
                ))
              )}
            </View>
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
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  options: { gap: spacing.sm },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceText: { color: colors.ink, fontWeight: '600' },
  choiceTextSelected: { color: colors.primaryDark },
  schedule: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  rowTitle: { color: colors.ink, fontWeight: '700' },
});

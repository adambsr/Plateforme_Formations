import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import type { User } from '../../core/auth/types';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type { Training } from '../trainings/types';
import type { Page, TrainerCost, TrainingCost, UserPage } from './types';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function money(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value / 100);
}

function displayUser(user: User) {
  return (
    [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') ||
    user.email
  );
}

function Choice({
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
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AdminCostsScreen() {
  const { user, request } = useAuth();
  const now = useMemo(() => new Date(), []);
  const today = useMemo(
    () =>
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    [now],
  );
  const [trainers, setTrainers] = useState<User[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [trainerCosts, setTrainerCosts] = useState<Page<TrainerCost> | null>(
    null,
  );
  const [trainingCosts, setTrainingCosts] = useState<Page<TrainingCost> | null>(
    null,
  );
  const [trainerPage, setTrainerPage] = useState(1);
  const [trainingPage, setTrainingPage] = useState(1);
  const [trainerId, setTrainerId] = useState('');
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [trainerAmount, setTrainerAmount] = useState('');
  const [note, setNote] = useState('');
  const [trainingId, setTrainingId] = useState('');
  const [date, setDate] = useState(today);
  const [trainingAmount, setTrainingAmount] = useState('');
  const [label, setLabel] = useState('');
  const [editing, setEditing] = useState<TrainingCost | null>(null);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      const [trainerResult, trainingResult, monthlyResult, explicitResult] =
        await Promise.all([
          request<UserPage>('/trainers?pageSize=100'),
          request<Page<Training>>('/trainings?view=MANAGED&pageSize=100'),
          request<Page<TrainerCost>>(
            `/costs/trainers?page=${trainerPage}&pageSize=12`,
          ),
          request<Page<TrainingCost>>(
            `/costs/trainings?page=${trainingPage}&pageSize=12`,
          ),
        ]);
      setTrainers(trainerResult.items);
      setTrainings(trainingResult.items);
      setTrainerCosts(monthlyResult);
      setTrainingCosts(explicitResult);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, trainerPage, trainingPage, user?.role]);

  useEffect(() => {
    // Options and both cost ledgers are synchronized with the backend.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function saveTrainerCost() {
    const amountMinor = Math.round(
      Number(trainerAmount.replace(',', '.')) * 100,
    );
    const numericYear = Number(year);
    const numericMonth = Number(month);
    if (
      trainerId === '' ||
      !Number.isInteger(numericYear) ||
      numericYear < 2000 ||
      numericYear > 2100 ||
      !Number.isInteger(numericMonth) ||
      numericMonth < 1 ||
      numericMonth > 12 ||
      !Number.isInteger(amountMinor) ||
      amountMinor <= 0
    ) {
      setError(
        'Choisissez un Formateur, un mois valide et un montant positif.',
      );
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(
        `/costs/trainers/${trainerId}/${numericYear}/${numericMonth}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            amountMinor,
            ...(note.trim() === '' ? {} : { note: note.trim() }),
          }),
        },
      );
      setTrainerAmount('');
      setNote('');
      setNotice('Coût mensuel Formateur enregistré.');
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  function resetTrainingCost() {
    setEditing(null);
    setTrainingId('');
    setDate(today);
    setTrainingAmount('');
    setLabel('');
  }

  function editTrainingCost(cost: TrainingCost) {
    setEditing(cost);
    setTrainingId(cost.training.id);
    setDate(cost.date);
    setTrainingAmount(String(cost.amountMinor / 100));
    setLabel(cost.label);
    setError('');
    setNotice('');
    setExpenseModalVisible(true);
  }

  async function saveTrainingCost(): Promise<boolean> {
    const amountMinor = Math.round(
      Number(trainingAmount.replace(',', '.')) * 100,
    );
    if (
      trainingId === '' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      label.trim() === '' ||
      !Number.isInteger(amountMinor) ||
      amountMinor <= 0
    ) {
      setError(
        'Renseignez la Formation, la date, le libellé et un montant positif.',
      );
      return false;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(
        editing === null
          ? '/costs/trainings'
          : `/costs/trainings/${editing.id}`,
        {
          method: editing === null ? 'POST' : 'PUT',
          body: JSON.stringify({
            trainingId,
            date,
            amountMinor,
            label: label.trim(),
          }),
        },
      );
      resetTrainingCost();
      setNotice('Dépense de Formation enregistrée.');
      await load();
      return true;
    } catch (caught) {
      setError(message(caught));
      return false;
    } finally {
      setSaving(false);
    }
  }

  function removeTrainingCost(cost: TrainingCost) {
    Alert.alert('Supprimer la dépense', `Supprimer « ${cost.label} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void request(`/costs/trainings/${cost.id}`, { method: 'DELETE' })
            .then(async () => {
              setNotice('Dépense supprimée.');
              if (editing?.id === cost.id) resetTrainingCost();
              await load();
            })
            .catch((caught: unknown) => setError(message(caught)))
            .finally(() => setSaving(false));
        },
      },
    ]);
  }

  if (user?.role !== 'ADMIN') return null;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && trainerCosts !== null}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>FINANCES</Text>
          <Text style={styles.title}>Coûts explicites</Text>
          <Text style={styles.muted}>
            Aucun salaire ou coût n’est déduit automatiquement.
          </Text>
        </View>
        <Notice message={error} />
        <Notice message={notice} success />
        {loading && trainerCosts === null ? (
          <StatePanel loading message="Chargement des coûts…" />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Coût mensuel Formateur</Text>
              <Text style={styles.label}>Formateur</Text>
              <View style={styles.options}>
                {trainers.map((trainer) => (
                  <Choice
                    key={trainer.id}
                    label={displayUser(trainer)}
                    onPress={() => setTrainerId(trainer.id)}
                    selected={trainerId === trainer.id}
                  />
                ))}
              </View>
              <TextField
                inputMode="numeric"
                label="Année"
                onChangeText={setYear}
                value={year}
              />
              <TextField
                inputMode="numeric"
                label="Mois (1–12)"
                onChangeText={setMonth}
                value={month}
              />
              <TextField
                inputMode="decimal"
                label="Montant EUR"
                onChangeText={setTrainerAmount}
                value={trainerAmount}
              />
              <TextField
                label="Note facultative"
                onChangeText={setNote}
                value={note}
              />
              <Button
                label="Enregistrer le coût mensuel"
                loading={saving}
                onPress={() => void saveTrainerCost()}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Historique des coûts Formateurs
              </Text>
              {trainerCosts?.items.length === 0 ? (
                <Text style={styles.muted}>Aucun coût mensuel renseigné.</Text>
              ) : (
                trainerCosts?.items.map((cost) => (
                  <View key={cost.id} style={styles.row}>
                    <Text style={styles.rowTitle}>
                      {[cost.trainer.firstName, cost.trainer.lastName]
                        .filter(Boolean)
                        .join(' ') || cost.trainer.email}
                    </Text>
                    <Text style={styles.rowMoney}>
                      {money(cost.amountMinor)}
                    </Text>
                    <Text style={styles.muted}>
                      {cost.month}/{cost.year}
                      {cost.note ? ` · ${cost.note}` : ''}
                    </Text>
                  </View>
                ))
              )}
              {trainerCosts !== null && (
                <View style={styles.pagination}>
                  <Button
                    disabled={trainerCosts.page <= 1}
                    label="Précédente"
                    onPress={() => setTrainerPage((value) => value - 1)}
                    variant="secondary"
                  />
                  <Text style={styles.muted}>Page {trainerCosts.page}</Text>
                  <Button
                    disabled={
                      trainerCosts.page * trainerCosts.pageSize >=
                      trainerCosts.total
                    }
                    label="Suivante"
                    onPress={() => setTrainerPage((value) => value + 1)}
                    variant="secondary"
                  />
                </View>
              )}
            </View>
            <Button label="Ajouter une dépense de formation" onPress={() => { resetTrainingCost(); setExpenseModalVisible(true); }} />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dépenses de Formation</Text>
              {trainingCosts?.items.length === 0 ? (
                <Text style={styles.muted}>Aucune dépense explicite.</Text>
              ) : (
                trainingCosts?.items.map((cost) => (
                  <View key={cost.id} style={styles.row}>
                    <Text style={styles.rowTitle}>{cost.training.title}</Text>
                    <Text style={styles.rowMoney}>
                      {money(cost.amountMinor)}
                    </Text>
                    <Text style={styles.muted}>
                      {cost.date} · {cost.label}
                    </Text>
                    <Button
                      label="Modifier"
                      onPress={() => editTrainingCost(cost)}
                      variant="secondary"
                    />
                    <Button
                      disabled={saving}
                      label="Supprimer"
                      onPress={() => removeTrainingCost(cost)}
                      variant="danger"
                    />
                  </View>
                ))
              )}
              {trainingCosts !== null && (
                <View style={styles.pagination}>
                  <Button
                    disabled={trainingCosts.page <= 1}
                    label="Précédente"
                    onPress={() => setTrainingPage((value) => value - 1)}
                    variant="secondary"
                  />
                  <Text style={styles.muted}>Page {trainingCosts.page}</Text>
                  <Button
                    disabled={
                      trainingCosts.page * trainingCosts.pageSize >=
                      trainingCosts.total
                    }
                    label="Suivante"
                    onPress={() => setTrainingPage((value) => value + 1)}
                    variant="secondary"
                  />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <Modal animationType="slide" transparent visible={expenseModalVisible} onRequestClose={() => setExpenseModalVisible(false)}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{editing === null ? 'Nouvelle dépense' : 'Modifier la dépense'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalForm}>
              <Text style={styles.label}>Formation</Text>
              <View style={styles.options}>{trainings.map((training) => <Choice key={training.id} label={training.title} onPress={() => setTrainingId(training.id)} selected={trainingId === training.id} />)}</View>
              <TextField autoCapitalize="none" label="Date (AAAA-MM-JJ)" onChangeText={setDate} value={date} />
              <TextField inputMode="decimal" label="Montant EUR" onChangeText={setTrainingAmount} value={trainingAmount} />
              <TextField label="Libellé" maxLength={200} onChangeText={setLabel} value={label} />
              <Button label={editing === null ? 'Créer la dépense' : 'Enregistrer les modifications'} loading={saving} onPress={() => void saveTrainingCost().then((saved) => { if (saved) setExpenseModalVisible(false); })} />
              <Button label="Annuler" variant="secondary" onPress={() => { resetTrainingCost(); setExpenseModalVisible(false); }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  options: { gap: spacing.sm, maxHeight: 220 },
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
  row: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  rowTitle: { color: colors.ink, fontWeight: '700' },
  rowMoney: { color: colors.success, fontSize: 18, fontWeight: '800' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(23,32,51,0.4)' },
  modalCard: { maxHeight: '88%', gap: spacing.md, borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md, padding: spacing.xl, backgroundColor: colors.surface },
  modalForm: { gap: spacing.md, paddingBottom: spacing.lg },
});

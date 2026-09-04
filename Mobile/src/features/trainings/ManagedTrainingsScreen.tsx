import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Archive, BookOpen, Edit3, Eye, Plus, Send, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import type { User } from '../../core/auth/types';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { StatePanel } from '../../shared/components/StatePanel';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type { Page, UserPage } from '../admin/types';
import type {
  PaginatedTrainings,
  Training,
  TrainingCategory,
  TrainingType,
} from './types';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function lines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function userName(user: User) {
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

export function ManagedTrainingsScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'ManagedTrainings'>) {
  const { user, request } = useAuth();
  const [page, setPage] = useState<PaginatedTrainings | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Training | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState('');
  const [type, setType] = useState<TrainingType>('SELF_PACED_ONLINE');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [price, setPrice] = useState('');
  const [minimumAttendancePercent, setMinimumAttendancePercent] =
    useState('80');
  const [objectives, setObjectives] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [ownerTrainerId, setOwnerTrainerId] = useState('');
  const [thumbnail, setThumbnail] = useState<ImagePicker.ImagePickerAsset>();
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user === null || user.role === 'LEARNER') return;
    setLoading(true);
    setError('');
    try {
      const [trainingPage, categoryList, trainerPage] = await Promise.all([
        request<Page<Training>>(
          `/trainings?view=MANAGED&page=${pageNumber}&pageSize=10`,
        ),
        request<TrainingCategory[]>('/categories'),
        user.role === 'ADMIN'
          ? request<UserPage>('/trainers?pageSize=100')
          : Promise.resolve(undefined),
      ]);
      setPage(trainingPage);
      setCategories(categoryList);
      setTrainers(trainerPage?.items.filter(({ isActive }) => isActive) ?? []);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, request, user]);

  useEffect(() => {
    // Managed Training scope and creation options come from the shared API.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  function resetEditor() {
    setEditing(null);
    setEditorOpen(false);
    setTitle('');
    setDescription('');
    setCategoryId('');
    setLevel('');
    setType('SELF_PACED_ONLINE');
    setDurationMinutes('');
    setPrice('');
    setMinimumAttendancePercent('80');
    setObjectives('');
    setPrerequisites('');
    setOwnerTrainerId('');
    setThumbnail(undefined);
    setThumbnailRemoved(false);
  }

  function edit(training: Training) {
    setEditing(training);
    setEditorOpen(true);
    setTitle(training.title);
    setDescription(training.description);
    setCategoryId(training.category.id);
    setLevel(training.level);
    setType(training.type);
    setDurationMinutes(String(training.durationMinutes));
    setPrice((training.priceMinor / 100).toFixed(2));
    setMinimumAttendancePercent(
      String(training.minimumAttendancePercent ?? 80),
    );
    setObjectives(training.objectives.join('\n'));
    setPrerequisites(training.prerequisites.join('\n'));
    setOwnerTrainerId(training.ownerTrainer.id);
    setThumbnail(undefined);
    setThumbnailRemoved(false);
    setError('');
    setNotice('');
  }

  async function save() {
    const priceMinor = Math.round(Number(price.replace(',', '.')) * 100);
    const duration = Number(durationMinutes);
    const minimum = Number(minimumAttendancePercent);
    if (
      title.trim() === '' ||
      description.trim() === '' ||
      categoryId === '' ||
      level.trim() === '' ||
      !Number.isInteger(duration) ||
      duration <= 0 ||
      !Number.isInteger(priceMinor) ||
      priceMinor <= 0 ||
      (type === 'IN_PERSON' &&
        (!Number.isInteger(minimum) || minimum < 1 || minimum > 100)) ||
      (editing === null && user?.role === 'ADMIN' && ownerTrainerId === '')
    ) {
      setError('Complétez les champs obligatoires avec des valeurs valides.');
      return;
    }
    const common = {
      title: title.trim(),
      description: description.trim(),
      categoryId,
      level: level.trim(),
      durationMinutes: duration,
      priceMinor,
      objectives: lines(objectives),
      prerequisites: lines(prerequisites),
      ...(type === 'IN_PERSON' ? { minimumAttendancePercent: minimum } : {}),
    };
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const saved = await request<Training>(
        editing === null ? '/trainings' : `/trainings/${editing.id}`,
        {
          method: editing === null ? 'POST' : 'PUT',
          body: JSON.stringify(
            editing === null
              ? {
                  ...common,
                  type,
                  ...(user?.role === 'ADMIN' ? { ownerTrainerId } : {}),
                }
              : common,
          ),
        },
      );
      if (
        editing !== null &&
        user?.role === 'ADMIN' &&
        ownerTrainerId !== '' &&
        ownerTrainerId !== editing.ownerTrainer.id
      ) {
        await request(`/trainings/${saved.id}/owner`, {
          method: 'PUT',
          body: JSON.stringify({ ownerTrainerId }),
        });
      }
      if (thumbnail !== undefined) {
        const body = new FormData();
        body.append('thumbnail', {
          uri: thumbnail.uri,
          name: thumbnail.fileName ?? 'thumbnail.jpg',
          type: thumbnail.mimeType ?? 'image/jpeg',
        } as unknown as Blob);
        await request(`/trainings/${saved.id}/thumbnail`, {
          method: 'PUT',
          body,
        });
      } else if (
        editing !== null &&
        thumbnailRemoved &&
        editing.thumbnailUrl !== undefined
      ) {
        await request(`/trainings/${saved.id}/thumbnail`, {
          method: 'DELETE',
        });
      }
      resetEditor();
      setNotice(
        editing === null
          ? 'Brouillon de Formation créé.'
          : 'Formation mise à jour.',
      );
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  async function pickThumbnail() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Autorisez l’accès aux photos pour choisir une miniature.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0] !== undefined) {
      setThumbnail(result.assets[0]);
      setThumbnailRemoved(false);
    }
  }

  async function transition(
    training: Training,
    action: 'publish' | 'archive' | 'unarchive',
  ) {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(`/trainings/${training.id}/${action}`, { method: 'POST' });
      setNotice(
        action === 'publish'
          ? 'Formation publiée.'
          : action === 'archive'
            ? 'Formation archivée.'
            : 'Formation restaurée en brouillon.',
      );
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  function remove(training: Training) {
    Alert.alert('Supprimer la Formation', `Supprimer « ${training.title} » ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setSaving(true);
          void request(`/trainings/${training.id}`, { method: 'DELETE' })
            .then(async () => {
              setNotice('Formation supprimée.');
              await load();
            })
            .catch((caught: unknown) => setError(message(caught)))
            .finally(() => setSaving(false));
        },
      },
    ]);
  }

  if (user === null || user.role === 'LEARNER') return null;
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
          <Text style={styles.eyebrow}>CATALOGUE</Text>
          <Text style={styles.title}>Formations gérées</Text>
        </View>
        {!editorOpen && (
          <Button
            label="Créer une Formation"
            icon={Plus}
            onPress={() => navigation.navigate('TrainingCreate')}
          />
        )}
        <Notice message={error} />
        <Notice message={notice} success />
        {editorOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {editing === null
                ? 'Nouvelle Formation'
                : 'Modifier la Formation'}
            </Text>
            <Text style={styles.muted}>
              Le type est immuable après la création. Le prix est saisi en EUR.
            </Text>
            <TextField
              label="Titre"
              maxLength={200}
              onChangeText={setTitle}
              value={title}
            />
            <TextField
              label="Description"
              maxLength={5000}
              multiline
              onChangeText={setDescription}
              value={description}
            />
            <Text style={styles.label}>Catégorie</Text>
            <View style={styles.options}>
              {categories.map((category) => (
                <Choice
                  key={category.id}
                  label={category.name}
                  onPress={() => setCategoryId(category.id)}
                  selected={categoryId === category.id}
                />
              ))}
            </View>
            <TextField
              label="Niveau"
              maxLength={100}
              onChangeText={setLevel}
              value={level}
            />
            <Text style={styles.label}>Type immuable</Text>
            <View style={styles.optionsRow}>
              <Choice
                label="En ligne autonome"
                onPress={() => editing === null && setType('SELF_PACED_ONLINE')}
                selected={type === 'SELF_PACED_ONLINE'}
              />
              <Choice
                label="Présentiel"
                onPress={() => editing === null && setType('IN_PERSON')}
                selected={type === 'IN_PERSON'}
              />
            </View>
            <TextField
              inputMode="numeric"
              label="Durée en minutes"
              onChangeText={setDurationMinutes}
              value={durationMinutes}
            />
            <TextField
              inputMode="decimal"
              label="Prix EUR"
              onChangeText={setPrice}
              value={price}
            />
            {type === 'IN_PERSON' && (
              <TextField
                inputMode="numeric"
                label="Présence minimale (%)"
                onChangeText={setMinimumAttendancePercent}
                value={minimumAttendancePercent}
              />
            )}
            <TextField
              label="Objectifs (un par ligne)"
              multiline
              onChangeText={setObjectives}
              value={objectives}
            />
            <TextField
              label="Prérequis (un par ligne)"
              multiline
              onChangeText={setPrerequisites}
              value={prerequisites}
            />
            <Text style={styles.label}>Miniature</Text>
            {thumbnail !== undefined && (
              <Image
                accessibilityLabel="Aperçu de la miniature"
                source={{ uri: thumbnail.uri }}
                style={styles.thumbnail}
              />
            )}
            {thumbnail === undefined &&
              editing?.thumbnailUrl !== undefined &&
              !thumbnailRemoved && (
                <Text style={styles.muted}>
                  Une miniature est actuellement enregistrée.
                </Text>
              )}
            <Button
              label={
                thumbnail === undefined
                  ? 'Choisir une miniature'
                  : 'Remplacer la miniature'
              }
              onPress={() => void pickThumbnail()}
              variant="secondary"
            />
            {(thumbnail !== undefined ||
              (editing?.thumbnailUrl !== undefined && !thumbnailRemoved)) && (
              <Button
                label="Supprimer la miniature"
                onPress={() => {
                  setThumbnail(undefined);
                  setThumbnailRemoved(true);
                }}
                variant="danger"
              />
            )}
            {user.role === 'ADMIN' && (
              <>
                <Text style={styles.label}>Formateur propriétaire</Text>
                <View style={styles.options}>
                  {trainers.map((trainer) => (
                    <Choice
                      key={trainer.id}
                      label={userName(trainer)}
                      onPress={() => setOwnerTrainerId(trainer.id)}
                      selected={ownerTrainerId === trainer.id}
                    />
                  ))}
                </View>
              </>
            )}
            <Button
              label={editing === null ? 'Créer le brouillon' : 'Enregistrer'}
              loading={saving}
              onPress={() => void save()}
            />
            <Button label="Annuler" onPress={resetEditor} variant="secondary" />
          </View>
        )}
        {loading && page === null ? (
          <StatePanel loading message="Chargement des Formations…" />
        ) : page === null || page.items.length === 0 ? (
          <StatePanel
            title="Aucune Formation gérée"
            message="Créez un premier brouillon pour commencer."
          />
        ) : (
          <>
            {page.items.map((training) => (
              <View key={training.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{training.title}</Text>
                  <Text style={styles.status}>{training.status}</Text>
                </View>
                <Text style={styles.muted}>
                  {training.category.name} ·{' '}
                  {training.type === 'IN_PERSON'
                    ? 'Présentiel'
                    : 'En ligne autonome'}
                </Text>
                <Button
                  label="Modifier"
                  icon={Edit3}
                  onPress={() => edit(training)}
                  variant="secondary"
                />
                <Button
                  label="Gérer le contenu"
                  icon={BookOpen}
                  onPress={() =>
                    navigation.navigate('Content', { trainingId: training.id })
                  }
                  variant="secondary"
                />
                <Button
                  label="Voir la fiche"
                  icon={Eye}
                  onPress={() =>
                    navigation.navigate('TrainingDetail', {
                      trainingId: training.id,
                    })
                  }
                  variant="secondary"
                />
                {training.status === 'DRAFT' && (
                  <Button
                    disabled={saving}
                    label="Publier"
                    icon={Send}
                    onPress={() => void transition(training, 'publish')}
                  />
                )}
                {training.status === 'PUBLISHED' && (
                  <Button
                    disabled={saving}
                    label="Archiver"
                    icon={Archive}
                    onPress={() => void transition(training, 'archive')}
                    variant="danger"
                  />
                )}
                {training.status === 'ARCHIVED' && (
                  <Button
                    disabled={saving}
                    label="Restaurer en brouillon"
                    onPress={() => void transition(training, 'unarchive')}
                    variant="secondary"
                  />
                )}
                {training.status === 'DRAFT' && (
                  <Button
                    disabled={saving}
                    label="Supprimer"
                    icon={Trash2}
                    onPress={() => remove(training)}
                    variant="danger"
                  />
                )}
              </View>
            ))}
            <View style={styles.pagination}>
              <Button
                disabled={page.page <= 1}
                label="Précédente"
                onPress={() => setPageNumber((value) => value - 1)}
                variant="secondary"
              />
              <Text style={styles.muted}>Page {page.page}</Text>
              <Button
                disabled={page.page * page.pageSize >= page.total}
                label="Suivante"
                onPress={() => setPageNumber((value) => value + 1)}
                variant="secondary"
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function TrainingCreateScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'TrainingCreate'>) {
  const { user, request } = useAuth();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [trainers, setTrainers] = useState<User[]>([]);
  const [ownerTrainerId, setOwnerTrainerId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('');
  const [type, setType] = useState<TrainingType>('SELF_PACED_ONLINE');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [price, setPrice] = useState('');
  const [minimumAttendancePercent, setMinimumAttendancePercent] = useState('80');
  const [objectives, setObjectives] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      request<TrainingCategory[]>('/categories'),
      user?.role === 'ADMIN'
        ? request<UserPage>('/trainers?pageSize=100')
        : Promise.resolve(undefined),
    ]).then(([categoryList, trainerPage]) => {
      setCategories(categoryList);
      setTrainers(trainerPage?.items.filter(({ isActive }) => isActive) ?? []);
    }).catch((caught) => setError(message(caught)));
  }, [request, user?.role]);

  async function submit() {
    const priceMinor = Math.round(Number(price.replace(',', '.')) * 100);
    const duration = Number(durationMinutes);
    const minimum = Number(minimumAttendancePercent);
    if (title.trim() === '' || description.trim() === '' || categoryId === '' || level.trim() === '' || !Number.isInteger(duration) || duration <= 0 || !Number.isInteger(priceMinor) || priceMinor <= 0 || (type === 'IN_PERSON' && (!Number.isInteger(minimum) || minimum < 1 || minimum > 100)) || (user?.role === 'ADMIN' && ownerTrainerId === '')) {
      setError('Complétez les champs obligatoires avec des valeurs valides.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await request('/trainings', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(), description: description.trim(), categoryId,
          level: level.trim(), durationMinutes: duration, priceMinor,
          objectives: lines(objectives), prerequisites: lines(prerequisites), type,
          ...(type === 'IN_PERSON' ? { minimumAttendancePercent: minimum } : {}),
          ...(user?.role === 'ADMIN' ? { ownerTrainerId } : {}),
        }),
      });
      navigation.replace('ManagedTrainings');
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }

  if (user === null || user.role === 'LEARNER') return null;
  const selectedCategory = categories.find(({ id }) => id === categoryId);
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>GESTION PÉDAGOGIQUE</Text>
          <Text style={styles.title}>Créer une formation</Text>
          <Text style={styles.muted}>Créez un brouillon, puis complétez son contenu pédagogique.</Text>
        </View>
        <Notice message={error} />
        <View style={styles.card}>
          <TextField label="Titre" onChangeText={setTitle} value={title} />
          <TextField label="Description" multiline onChangeText={setDescription} value={description} />
          <Text style={styles.label}>Catégorie</Text>
          <Pressable style={styles.choice} onPress={() => setCategoryOpen(true)}>
            <Text style={styles.choiceText}>{selectedCategory?.name ?? 'Sélectionner une catégorie'}</Text>
          </Pressable>
          <Modal transparent visible={categoryOpen} animationType="fade" onRequestClose={() => setCategoryOpen(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setCategoryOpen(false)}>
              <View style={styles.modalCard}>
                <Text style={styles.cardTitle}>Choisir une catégorie</Text>
                {categories.map((category) => (
                  <Choice key={category.id} label={category.name} selected={category.id === categoryId} onPress={() => { setCategoryId(category.id); setCategoryOpen(false); }} />
                ))}
              </View>
            </Pressable>
          </Modal>
          <TextField label="Niveau" onChangeText={setLevel} value={level} />
          <Text style={styles.label}>Type</Text>
          <View style={styles.optionsRow}>
            <Choice label="En ligne autonome" selected={type === 'SELF_PACED_ONLINE'} onPress={() => setType('SELF_PACED_ONLINE')} />
            <Choice label="Présentiel" selected={type === 'IN_PERSON'} onPress={() => setType('IN_PERSON')} />
          </View>
          <TextField inputMode="numeric" label="Durée en minutes" onChangeText={setDurationMinutes} value={durationMinutes} />
          <TextField inputMode="decimal" label="Prix EUR" onChangeText={setPrice} value={price} />
          {type === 'IN_PERSON' && <TextField inputMode="numeric" label="Présence minimale (%)" onChangeText={setMinimumAttendancePercent} value={minimumAttendancePercent} />}
          <TextField label="Objectifs (un par ligne)" multiline onChangeText={setObjectives} value={objectives} />
          <TextField label="Prérequis (un par ligne)" multiline onChangeText={setPrerequisites} value={prerequisites} />
          {user.role === 'ADMIN' && (
            <>
              <Text style={styles.label}>Formateur propriétaire</Text>
              <View style={styles.options}>
                {trainers.map((trainer) => (
                  <Choice key={trainer.id} label={userName(trainer)} selected={trainer.id === ownerTrainerId} onPress={() => setOwnerTrainerId(trainer.id)} />
                ))}
              </View>
            </>
          )}
          <Button label="Créer le brouillon" icon={Plus} loading={busy} onPress={() => void submit()} />
          <Button label="Annuler" onPress={() => navigation.goBack()} variant="secondary" />
        </View>
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
  cardTitle: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  options: { gap: spacing.sm },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  status: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '800',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radii.sm,
    backgroundColor: colors.line,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(23,32,51,0.45)',
  },
  modalCard: {
    gap: spacing.sm,
    maxHeight: '80%',
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
});

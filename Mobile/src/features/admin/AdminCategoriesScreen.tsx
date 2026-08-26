import { useCallback, useEffect, useState } from 'react';
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
import type { TrainingCategory } from '../trainings/types';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

export function AdminCategoriesScreen() {
  const { user, request } = useAuth();
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [editing, setEditing] = useState<TrainingCategory | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      setCategories(
        await request<TrainingCategory[]>('/categories?includeArchived=true'),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, user?.role]);

  useEffect(() => {
    // Admin category state comes from the shared catalogue endpoint.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  function reset() {
    setEditing(null);
    setEditorOpen(false);
    setName('');
    setDescription('');
  }

  async function save() {
    if (name.trim() === '') {
      setError('Renseignez le nom de la catégorie.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(
        editing === null ? '/categories' : `/categories/${editing.id}`,
        {
          method: editing === null ? 'POST' : 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            ...(description.trim() === ''
              ? editing === null
                ? {}
                : { description: null }
              : { description: description.trim() }),
          }),
        },
      );
      reset();
      setNotice('Catégorie enregistrée.');
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive(category: TrainingCategory) {
    setSaving(true);
    setError('');
    try {
      await request(`/categories/${category.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isArchived: !category.isArchived }),
      });
      setNotice(
        category.isArchived ? 'Catégorie restaurée.' : 'Catégorie archivée.',
      );
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
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
            refreshing={loading && categories.length > 0}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>CATALOGUE</Text>
          <Text style={styles.title}>Catégories</Text>
        </View>
        {!editorOpen && (
          <Button
            label="Créer une catégorie"
            onPress={() => setEditorOpen(true)}
          />
        )}
        {editorOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {editing === null
                ? 'Nouvelle catégorie'
                : 'Modifier la catégorie'}
            </Text>
            <TextField
              label="Nom"
              maxLength={120}
              onChangeText={setName}
              value={name}
            />
            <TextField
              label="Description facultative"
              maxLength={1000}
              multiline
              onChangeText={setDescription}
              value={description}
            />
            <Button
              label="Enregistrer"
              loading={saving}
              onPress={() => void save()}
            />
            <Button label="Annuler" onPress={reset} variant="secondary" />
          </View>
        )}
        <Notice message={error} />
        <Notice message={notice} success />
        {loading && categories.length === 0 ? (
          <StatePanel loading message="Chargement des catégories…" />
        ) : categories.length === 0 ? (
          <StatePanel
            title="Aucune catégorie"
            message="Créez une catégorie avant une Formation."
          />
        ) : (
          categories.map((category) => (
            <View key={category.id} style={styles.card}>
              <Text style={styles.cardTitle}>{category.name}</Text>
              <Text style={styles.muted}>
                {category.description || 'Sans description'}
              </Text>
              <Text
                style={category.isArchived ? styles.archived : styles.active}
              >
                {category.isArchived ? 'Archivée' : 'Active'}
              </Text>
              <Button
                label="Modifier"
                onPress={() => {
                  setEditing(category);
                  setEditorOpen(true);
                  setName(category.name);
                  setDescription(category.description ?? '');
                }}
                variant="secondary"
              />
              <Button
                disabled={saving}
                label={category.isArchived ? 'Restaurer' : 'Archiver'}
                onPress={() => void toggleArchive(category)}
                variant={category.isArchived ? 'secondary' : 'danger'}
              />
            </View>
          ))
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
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  active: { color: colors.success, fontWeight: '800' },
  archived: { color: colors.danger, fontWeight: '800' },
});

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import type { UserPage } from './types';

type Tab = 'TRAINERS' | 'LEARNERS';

function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function name(user: User) {
  return (
    [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') ||
    user.email
  );
}

export function AdminUsersScreen() {
  const { user, request } = useAuth();
  const [tab, setTab] = useState<Tab>('TRAINERS');
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<UserPage | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      const path = tab === 'TRAINERS' ? '/trainers' : '/learners';
      setPage(
        await request<UserPage>(`${path}?page=${pageNumber}&pageSize=10`),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, request, tab, user?.role]);

  useEffect(() => {
    // The selected role and page drive the backend-authorized user collection.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  function resetEditor() {
    setEditing(null);
    setCreating(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setTemporaryPassword('');
  }

  function editTrainer(trainer: User) {
    setEditing(trainer);
    setCreating(false);
    setFirstName(trainer.profile.firstName ?? '');
    setLastName(trainer.profile.lastName ?? '');
    setEmail(trainer.email);
    setTemporaryPassword('');
    setError('');
    setNotice('');
  }

  async function saveTrainer() {
    if (firstName.trim() === '' || lastName.trim() === '') {
      setError('Renseignez le prénom et le nom.');
      return;
    }
    if (
      editing === null &&
      (!email.includes('@') || temporaryPassword.length < 8)
    ) {
      setError(
        'Renseignez un email valide et un mot de passe d’au moins 8 caractères.',
      );
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await request(
        editing === null ? '/trainers' : `/trainers/${editing.id}`,
        {
          method: editing === null ? 'POST' : 'PUT',
          body: JSON.stringify(
            editing === null
              ? {
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  email: email.trim(),
                  temporaryPassword,
                }
              : { firstName: firstName.trim(), lastName: lastName.trim() },
          ),
        },
      );
      setNotice(
        editing === null
          ? 'Compte Formateur créé. Transmettez ses accès par un canal sécurisé.'
          : 'Profil Formateur mis à jour.',
      );
      resetEditor();
      await load();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSaving(false);
    }
  }

  function disableTrainer(trainer: User) {
    Alert.alert(
      'Désactiver le Formateur',
      `${name(trainer)} ne pourra plus se connecter.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            setError('');
            void request(`/trainers/${trainer.id}/disable`, { method: 'POST' })
              .then(async () => {
                setNotice('Compte Formateur désactivé.');
                await load();
              })
              .catch((caught: unknown) => setError(message(caught)))
              .finally(() => setSaving(false));
          },
        },
      ],
    );
  }

  if (user?.role !== 'ADMIN') return null;
  const editorOpen = creating || editing !== null;
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
          <Text style={styles.eyebrow}>ADMINISTRATION</Text>
          <Text style={styles.title}>Utilisateurs</Text>
        </View>
        <View style={styles.tabs}>
          {(['TRAINERS', 'LEARNERS'] as const).map((value) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              key={value}
              onPress={() => {
                setTab(value);
                setPageNumber(1);
                resetEditor();
              }}
              style={[styles.tab, tab === value && styles.tabSelected]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === value && styles.tabTextSelected,
                ]}
              >
                {value === 'TRAINERS' ? 'Formateurs' : 'Apprenants'}
              </Text>
            </Pressable>
          ))}
        </View>
        {tab === 'TRAINERS' && !editorOpen && (
          <Button
            label="Créer un Formateur"
            onPress={() => {
              resetEditor();
              setCreating(true);
            }}
          />
        )}
        {editorOpen && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {editing === null ? 'Nouveau Formateur' : 'Modifier le Formateur'}
            </Text>
            {editing === null && (
              <Text style={styles.muted}>
                Il devra remplacer ce mot de passe temporaire à la première
                connexion.
              </Text>
            )}
            <TextField
              label="Prénom"
              onChangeText={setFirstName}
              value={firstName}
            />
            <TextField
              label="Nom"
              onChangeText={setLastName}
              value={lastName}
            />
            {editing === null && (
              <>
                <TextField
                  autoCapitalize="none"
                  autoComplete="email"
                  inputMode="email"
                  label="Adresse email"
                  onChangeText={setEmail}
                  value={email}
                />
                <TextField
                  autoComplete="new-password"
                  label="Mot de passe temporaire"
                  onChangeText={setTemporaryPassword}
                  secureTextEntry
                  value={temporaryPassword}
                />
              </>
            )}
            <Button
              label={editing === null ? 'Créer le compte' : 'Enregistrer'}
              loading={saving}
              onPress={() => void saveTrainer()}
            />
            <Button label="Annuler" onPress={resetEditor} variant="secondary" />
          </View>
        )}
        <Notice message={error} />
        <Notice message={notice} success />
        {loading && page === null ? (
          <StatePanel loading message="Chargement des utilisateurs…" />
        ) : page === null || page.items.length === 0 ? (
          <StatePanel
            title={tab === 'TRAINERS' ? 'Aucun Formateur' : 'Aucun Apprenant'}
            message="Les comptes correspondants apparaîtront ici."
          />
        ) : (
          <>
            {page.items.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>{name(item)}</Text>
                  <Text style={item.isActive ? styles.active : styles.inactive}>
                    {item.isActive ? 'Actif' : 'Désactivé'}
                  </Text>
                </View>
                <Text style={styles.muted}>{item.email}</Text>
                {tab === 'TRAINERS' && (
                  <>
                    <Button
                      label="Modifier"
                      onPress={() => editTrainer(item)}
                      variant="secondary"
                    />
                    {item.isActive && (
                      <Button
                        disabled={saving}
                        label="Désactiver"
                        onPress={() => disableTrainer(item)}
                        variant="danger"
                      />
                    )}
                  </>
                )}
              </View>
            ))}
            <View style={styles.pagination}>
              <Button
                disabled={page.page <= 1 || loading}
                label="Précédente"
                onPress={() => setPageNumber((value) => value - 1)}
                variant="secondary"
              />
              <Text style={styles.muted}>Page {page.page}</Text>
              <Button
                disabled={page.page * page.pageSize >= page.total || loading}
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
  tabs: { flexDirection: 'row', gap: spacing.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  tabSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText: { color: colors.ink, fontWeight: '700' },
  tabTextSelected: { color: colors.surface },
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
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  active: { color: colors.success, fontWeight: '800' },
  inactive: { color: colors.danger, fontWeight: '800' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});

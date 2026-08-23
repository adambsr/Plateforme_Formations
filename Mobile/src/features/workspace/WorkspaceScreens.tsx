import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Brand } from '../../shared/components/Brand';
import { Button } from '../../shared/components/Button';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { roleWorkspace } from './role-workspace';

function displayName(profile: {
  firstName?: string;
  lastName?: string;
}): string {
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'Votre espace'
  );
}

export function WorkspaceScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Workspace'>) {
  const { user, logout } = useAuth();
  if (user === null) return null;
  const workspace = roleWorkspace(user.role);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Brand />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{workspace.eyebrow}</Text>
          <Text style={styles.title}>
            {workspace.title}, {displayName(user.profile)}
          </Text>
          <Text style={styles.description}>{workspace.description}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Compte connecté</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.muted}>
            Votre navigation est adaptée au rôle {user.role.toLowerCase()}.
          </Text>
          <Button
            label="Mon profil"
            onPress={() => navigation.navigate('Profile')}
            variant="secondary"
          />
          <Button
            label="Se déconnecter"
            onPress={() => void logout()}
            variant="link"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ProfileScreen() {
  const { user, updateProfile, logout } = useAuth();
  const [firstName, setFirstName] = useState(user?.profile.firstName ?? '');
  const [lastName, setLastName] = useState(user?.profile.lastName ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user === null) return null;

  async function submit() {
    if (firstName.trim().length === 0 || lastName.trim().length === 0) {
      setError('Renseignez votre prénom et votre nom.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await updateProfile(firstName, lastName);
      setMessage('Votre profil a été mis à jour.');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Une erreur inattendue est survenue.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations personnelles</Text>
            <Text style={styles.muted}>{user.email}</Text>
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
            {error !== '' && <Text style={styles.error}>{error}</Text>}
            {message !== '' && <Text style={styles.success}>{message}</Text>}
            <Button
              label="Enregistrer"
              loading={loading}
              onPress={() => void submit()}
            />
            <Button
              label="Se déconnecter"
              onPress={() => void logout()}
              variant="danger"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.xl, padding: spacing.xl },
  hero: {
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.primaryDark,
  },
  eyebrow: {
    color: '#bcd8f5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  description: { color: '#dbe7f5', fontSize: 15, lineHeight: 22 },
  card: {
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  email: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  success: {
    color: colors.success,
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
});

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { openBackendLink } from '../../app/navigation/backend-link';
import type { AppStackParamList } from '../../app/navigation/types';
import { useAuth } from '../../core/auth/AuthContext';
import { StatePanel } from '../../shared/components/StatePanel';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type { SearchResponse, SearchResultType } from './types';

const labels: Record<SearchResultType, string> = {
  TRAINING: 'Formations',
  LESSON: 'Cours',
  SESSION: 'Sessions',
  USER: 'Utilisateurs',
  EVALUATION: 'Évaluations',
  PAYMENT: 'Paiements',
  CERTIFICATE: 'Certificats',
};

export function SearchScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Search'>) {
  const navigate = navigation.navigate as unknown as (
    name: keyof AppStackParamList,
    params?: object,
  ) => void;
  const { request, user } = useAuth();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      // Clear stale server results when the active query is no longer valid.
      // oxlint-disable-next-line react/set-state-in-effect
      setResponse(null);
      setLoading(false);
      setError(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      void request<SearchResponse>(
        `/search?q=${encodeURIComponent(trimmed)}&limit=8`,
      )
        .then((result) => {
          if (active) setResponse(result);
        })
        .catch(() => {
          if (active) {
            setResponse(null);
            setError(true);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 320);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, request]);

  const placeholder =
    user?.role === 'ADMIN'
      ? 'Utilisateur, formation, session…'
      : user?.role === 'TRAINER'
        ? 'Formation, apprenant, évaluation…'
        : 'Formation, cours, évaluation…';
  const hasResults =
    response?.groups.some(({ items }) => items.length > 0) ?? false;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>RECHERCHE GLOBALE</Text>
      <Text style={styles.title}>Que recherchez-vous ?</Text>
      <TextField
        autoFocus
        label="Recherche"
        onChangeText={setQuery}
        placeholder={placeholder}
        returnKeyType="search"
        value={query}
      />
      {query.trim().length < 2 && (
        <Text style={styles.hint}>Saisissez au moins deux caractères.</Text>
      )}
      {loading && <StatePanel loading message="Recherche…" />}
      {!loading && error && (
        <StatePanel
          title="Recherche indisponible"
          message="Vérifiez votre connexion puis réessayez."
        />
      )}
      {!loading && !error && response !== null && !hasResults && (
        <StatePanel
          title="Aucun résultat"
          message={`Aucun résultat autorisé pour « ${response.query} ».`}
        />
      )}
      {!loading &&
        !error &&
        response?.groups.map((group) => (
          <View key={group.type} style={styles.group}>
            <Text style={styles.groupTitle}>{labels[group.type]}</Text>
            {group.items.map((item) => (
              <Pressable
                key={`${item.type}-${item.id}`}
                accessibilityRole="button"
                onPress={() =>
                  openBackendLink(
                    navigate,
                    item.link,
                  )
                }
                style={({ pressed }) => [
                  styles.result,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.resultIcon}>
                  <Text style={styles.resultInitial}>
                    {item.title.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={styles.hint}>{item.subtitle}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  group: { gap: spacing.sm },
  groupTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  result: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  resultIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
  },
  resultInitial: { color: colors.primaryDark, fontWeight: '800' },
  resultTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.72 },
});

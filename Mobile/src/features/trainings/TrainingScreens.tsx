import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  AppStackParamList,
  GuestStackParamList,
} from '../../app/navigation/types';
import { ApiError, apiAssetUrl } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Brand } from '../../shared/components/Brand';
import { Button } from '../../shared/components/Button';
import { StatePanel } from '../../shared/components/StatePanel';
import { ScrollToTopButton } from '../../shared/components/ScrollToTopButton';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { PublicSessions } from '../sessions/SessionScreens';
import type { CheckoutResponse } from '../payments/types';
import {
  formatDuration,
  formatEur,
  trainerName,
  trainingTypeLabel,
} from './format';
import { trainingApi } from './training-api';
import type {
  PaginatedTrainings,
  Training,
  TrainingCategory,
  TrainingType,
} from './types';

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function TrainingThumbnail({ training }: { training: Training }) {
  const [failed, setFailed] = useState(false);
  if (training.thumbnailUrl === undefined || failed) {
    return (
      <View
        style={styles.thumbnailFallback}
        accessibilityLabel="Aucune miniature disponible"
      >
        <Text style={styles.thumbnailFallbackText}>HSA</Text>
      </View>
    );
  }
  return (
    <Image
      accessibilityLabel={`Miniature de la formation ${training.title}`}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: apiAssetUrl(training.thumbnailUrl) }}
      style={styles.thumbnail}
    />
  );
}

function FilterChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilterRow({ children }: React.PropsWithChildren) {
  return (
    <ScrollView
      contentContainerStyle={styles.filterRow}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

function TrainingCard({
  training,
  onPress,
}: {
  training: Training;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Voir la formation ${training.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <TrainingThumbnail training={training} />
      <View style={styles.cardBody}>
        <View style={styles.metaRow}>
          <Text
            style={[
              styles.badge,
              training.type === 'IN_PERSON' && styles.badgeInPerson,
            ]}
          >
            {trainingTypeLabel(training.type)}
          </Text>
          <Text style={styles.category} numberOfLines={1}>
            {training.category.name}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{training.title}</Text>
        <Text style={styles.summary} numberOfLines={3}>
          {training.description}
        </Text>
        <View style={styles.factsRow}>
          <Fact label="Niveau" value={training.level} compact />
          <Fact
            label="Durée"
            value={formatDuration(training.durationMinutes)}
            compact
          />
          <Fact label="Prix" value={formatEur(training.priceMinor)} compact />
        </View>
        <Text style={styles.primaryLink}>Voir la formation →</Text>
      </View>
    </Pressable>
  );
}

function Fact({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.fact, compact && styles.factCompact]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function CatalogueView({
  guest,
  onLogin,
  onOpenTraining,
}: {
  guest: boolean;
  onLogin?: () => void;
  onOpenTraining: (trainingId: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [page, setPage] = useState<PaginatedTrainings | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [categoryId, setCategoryId] = useState<string>();
  const [type, setType] = useState<TrainingType>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [categoryResult, trainingResult] = await Promise.all([
        trainingApi.listCategories(),
        trainingApi.listTrainings({ page: pageNumber, categoryId, type }),
      ]);
      setCategories(categoryResult);
      setPage(trainingResult);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [categoryId, pageNumber, type]);

  useEffect(() => {
    // Filter/page changes synchronize this screen with server-owned catalogue data.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  function selectCategory(nextCategoryId?: string) {
    setCategoryId(nextCategoryId);
    setPageNumber(1);
  }

  function selectType(nextType?: TrainingType) {
    setType(nextType);
    setPageNumber(1);
  }

  return (
    <SafeAreaView
      edges={['bottom']}
      style={styles.safeArea}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.catalogueContent}
        onScroll={(event) =>
          setShowScrollTop(event.nativeEvent.contentOffset.y > 320)
        }
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && page !== null}
            tintColor={colors.primary}
          />
        }
      >
        {guest && (
          <View style={styles.publicHeader}>
            <Brand />
            <View style={styles.loginAction}>
              <Button label="Connexion" onPress={onLogin} variant="secondary" />
            </View>
          </View>
        )}
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>CATALOGUE PUBLIC</Text>
          <Text style={styles.pageTitle}>Développez vos compétences</Text>
          <Text style={styles.lead}>
            Découvrez les formations publiées du centre, en ligne ou en
            présentiel.
          </Text>
        </View>

        <View style={styles.filters} accessibilityLabel="Filtres du catalogue">
          <Text style={styles.filterLabel}>Modalité</Text>
          <FilterRow>
            <FilterChip
              label="Toutes"
              onPress={() => selectType()}
              selected={type === undefined}
            />
            <FilterChip
              label="En ligne autonome"
              onPress={() => selectType('SELF_PACED_ONLINE')}
              selected={type === 'SELF_PACED_ONLINE'}
            />
            <FilterChip
              label="Présentiel"
              onPress={() => selectType('IN_PERSON')}
              selected={type === 'IN_PERSON'}
            />
          </FilterRow>
          <Text style={styles.filterLabel}>Catégorie</Text>
          <FilterRow>
            <FilterChip
              label="Toutes"
              onPress={() => selectCategory()}
              selected={categoryId === undefined}
            />
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                label={category.name}
                onPress={() => selectCategory(category.id)}
                selected={categoryId === category.id}
              />
            ))}
          </FilterRow>
        </View>

        {loading && page === null ? (
          <StatePanel loading message="Chargement du catalogue…" />
        ) : error !== '' ? (
          <StatePanel message={error} retry={() => void load()} />
        ) : page === null || page.items.length === 0 ? (
          <StatePanel
            title="Aucune formation publiée"
            message="Modifiez les filtres ou revenez plus tard."
          />
        ) : (
          <>
            <View style={styles.list}>
              {page.items.map((training) => (
                <TrainingCard
                  key={training.id}
                  onPress={() => onOpenTraining(training.id)}
                  training={training}
                />
              ))}
            </View>
            <View style={styles.pagination}>
              <Button
                disabled={page.page <= 1}
                label="Précédent"
                onPress={() => setPageNumber((current) => current - 1)}
                variant="secondary"
              />
              <Text style={styles.paginationText}>
                Page {page.page} · {page.total} formation(s)
              </Text>
              <Button
                disabled={page.page * page.pageSize >= page.total}
                label="Suivant"
                onPress={() => setPageNumber((current) => current + 1)}
                variant="secondary"
              />
            </View>
          </>
        )}
      </ScrollView>
      <ScrollToTopButton
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </SafeAreaView>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.detailSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>Aucune information détaillée.</Text>
      ) : (
        items.map((item) => (
          <View key={item} style={styles.listItem}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.listItemText}>{item}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function TrainingDetailView({
  trainingId,
  onLogin,
}: {
  trainingId: string;
  onLogin?: () => void;
}) {
  const { user, request } = useAuth();
  const [training, setTraining] = useState<Training | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasingSessionId, setPurchasingSessionId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTraining(await trainingApi.getTraining(trainingId));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [trainingId]);

  useEffect(() => {
    // The route identifier selects the server-owned Training detail.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function checkout(sessionId?: string) {
    if (training === null || user?.role !== 'LEARNER') return;
    setPurchasingSessionId(sessionId ?? 'SELF_PACED');
    setError('');
    try {
      const result = await request<CheckoutResponse>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          trainingId: training.id,
          ...(sessionId === undefined ? {} : { sessionId }),
          client: 'MOBILE',
        }),
      });
      await Linking.openURL(result.checkoutUrl);
    } catch (caught) {
      setError(errorMessage(caught));
      setPurchasingSessionId(undefined);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.detailContent}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && training !== null}
            tintColor={colors.primary}
          />
        }
      >
        {loading && training === null ? (
          <StatePanel loading message="Chargement de la formation…" />
        ) : error !== '' || training === null ? (
          <StatePanel
            message={error || 'Formation introuvable.'}
            retry={() => void load()}
          />
        ) : (
          <>
            <View style={styles.detailHero}>
              <Text style={styles.eyebrow}>{training.category.name}</Text>
              <Text style={styles.pageTitle}>{training.title}</Text>
              <TrainingThumbnail training={training} />
              <Text style={styles.detailLead}>{training.description}</Text>
            </View>
            <View style={styles.detailFacts}>
              <Fact label="Modalité" value={trainingTypeLabel(training.type)} />
              <Fact label="Niveau" value={training.level} />
              <Fact
                label="Durée"
                value={formatDuration(training.durationMinutes)}
              />
              <Fact label="Prix" value={formatEur(training.priceMinor)} />
            </View>
            <DetailList items={training.objectives} title="Objectifs" />
            <DetailList items={training.prerequisites} title="Prérequis" />
            <View style={styles.trainerCard}>
              <Text style={styles.factLabel}>FORMATEUR</Text>
              <Text style={styles.trainerName}>{trainerName(training)}</Text>
            </View>
            {training.type === 'IN_PERSON' && (
              <PublicSessions
                trainingId={training.id}
                purchasingSessionId={purchasingSessionId}
                {...(user?.role === 'LEARNER'
                  ? {
                      onPurchase: (sessionId: string) =>
                        void checkout(sessionId),
                    }
                  : {})}
              />
            )}
            {user?.role === 'LEARNER' &&
              training.type === 'SELF_PACED_ONLINE' && (
                <Button
                  label="Acheter avec Stripe test"
                  loading={purchasingSessionId === 'SELF_PACED'}
                  onPress={() => void checkout()}
                />
              )}
            {user === null && onLogin !== undefined && (
              <Button label="Se connecter pour acheter" onPress={onLogin} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function GuestCatalogueScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'Catalogue'>) {
  return (
    <CatalogueView
      guest
      onLogin={() => navigation.navigate('Login')}
      onOpenTraining={(trainingId) =>
        navigation.navigate('TrainingDetail', { trainingId })
      }
    />
  );
}

export function AppCatalogueScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Catalogue'>) {
  return (
    <CatalogueView
      guest={false}
      onOpenTraining={(trainingId) =>
        navigation.navigate('TrainingDetail', { trainingId })
      }
    />
  );
}

export function GuestTrainingDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<GuestStackParamList, 'TrainingDetail'>) {
  return (
    <TrainingDetailView
      onLogin={() => navigation.navigate('Login')}
      trainingId={route.params.trainingId}
    />
  );
}

export function AppTrainingDetailScreen({
  route,
}: NativeStackScreenProps<AppStackParamList, 'TrainingDetail'>) {
  return <TrainingDetailView trainingId={route.params.trainingId} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  catalogueContent: { gap: spacing.xl, padding: spacing.lg, paddingBottom: 40 },
  detailContent: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 40 },
  publicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  loginAction: { minWidth: 116 },
  intro: { gap: spacing.sm, paddingVertical: spacing.sm },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  pageTitle: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  filters: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
  },
  filterLabel: {
    paddingHorizontal: spacing.lg,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  filterRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  filterChip: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.canvas,
  },
  filterChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  filterChipText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  filterChipTextSelected: { color: colors.primaryDark },
  pressed: { opacity: 0.75 },
  list: { gap: spacing.lg },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  thumbnail: {
    width: '100%',
    height: 184,
    backgroundColor: colors.primarySoft,
  },
  thumbnailFallback: {
    width: '100%',
    height: 184,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  thumbnailFallbackText: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardBody: { gap: spacing.md, padding: spacing.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeInPerson: { color: colors.success, backgroundColor: colors.successSoft },
  category: { flex: 1, color: colors.muted, fontSize: 13 },
  cardTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  summary: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  factsRow: { flexDirection: 'row', gap: spacing.sm },
  fact: {
    flex: 1,
    gap: spacing.xs,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.canvas,
  },
  factCompact: { minWidth: 0, paddingHorizontal: spacing.sm },
  factLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  factValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  primaryLink: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  pagination: { gap: spacing.sm },
  paginationText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  detailHero: {
    gap: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  detailLead: { color: colors.ink, fontSize: 16, lineHeight: 25 },
  detailFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detailSection: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  listItem: { flexDirection: 'row', gap: spacing.sm },
  bullet: { color: colors.primary, fontSize: 18, lineHeight: 23 },
  listItemText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 23 },
  trainerCard: {
    gap: spacing.xs,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.primaryDark,
  },
  trainerName: { color: colors.surface, fontSize: 18, fontWeight: '700' },
});

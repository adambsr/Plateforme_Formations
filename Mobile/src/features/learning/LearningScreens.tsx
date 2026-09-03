import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../app/navigation/types';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { shareFile } from '../../core/files/share';
import { Button } from '../../shared/components/Button';
import { Notice } from '../../shared/components/Notice';
import { ProgressBar } from '../../shared/components/ProgressBar';
import { StatePanel } from '../../shared/components/StatePanel';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type {
  ContentLesson,
  ContentResource,
  PaginatedProgress,
  ProgressSummary,
  TrainingContent,
} from './types';
import { ContentManagementPanel } from './ContentManagementPanel';
import { TutorChat } from './TutorChat';

function message(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Une erreur inattendue est survenue.';
}

function ResourceRow({
  resource,
  busy,
  open,
}: {
  resource: ContentResource;
  busy: boolean;
  open: () => void;
}) {
  return (
    <View style={styles.resource}>
      <View style={styles.flex}>
        <Text style={styles.resourceTitle}>{resource.title}</Text>
        {resource.description !== '' && (
          <Text style={styles.muted}>{resource.description}</Text>
        )}
        <Text style={styles.resourceMeta}>
          {resource.type === 'FILE'
            ? resource.file?.originalName
            : 'Ressource externe'}
        </Text>
      </View>
      <View style={styles.resourceAction}>
        <Button
          label={resource.type === 'FILE' ? 'Télécharger' : 'Ouvrir'}
          loading={busy}
          onPress={open}
          variant="secondary"
        />
      </View>
    </View>
  );
}

function LessonCard({
  lesson,
  completed,
  locked,
  saving,
  onToggle,
  onOpenResource,
  resourceBusyId,
  forceOpen = false,
}: {
  lesson: ContentLesson;
  completed: boolean;
  locked: boolean;
  saving: boolean;
  onToggle: () => void;
  onOpenResource: (resource: ContentResource) => void;
  resourceBusyId?: string;
  forceOpen?: boolean;
}) {
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const expanded = forceOpen || manuallyExpanded;
  return (
    <View style={[styles.lessonCard, forceOpen && styles.lessonCardFocused]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setManuallyExpanded((value) => !value)}
        style={styles.lessonHeader}
      >
        <View style={styles.flex}>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.muted} numberOfLines={expanded ? undefined : 2}>
            {lesson.description || 'Leçon pédagogique'}
          </Text>
        </View>
        <Text style={styles.expand}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded && (
        <View style={styles.lessonBody}>
          {lesson.textContent !== '' && (
            <Text style={styles.bodyText}>{lesson.textContent}</Text>
          )}
          {lesson.instructions !== '' && (
            <View style={styles.instructions}>
              <Text style={styles.resourceTitle}>Instructions</Text>
              <Text style={styles.bodyText}>{lesson.instructions}</Text>
            </View>
          )}
          {lesson.resources.length === 0 ? (
            <Text style={styles.muted}>Aucune ressource pour cette leçon.</Text>
          ) : (
            lesson.resources.map((resource) => (
              <ResourceRow
                key={resource.id}
                busy={resourceBusyId === resource.id}
                open={() => onOpenResource(resource)}
                resource={resource}
              />
            ))
          )}
          <Button
            disabled={locked}
            label={completed ? 'Marquer comme non terminée' : 'Leçon terminée'}
            loading={saving}
            onPress={onToggle}
            variant={completed ? 'secondary' : 'primary'}
          />
        </View>
      )}
    </View>
  );
}

export function ContentScreen({
  route,
}: NativeStackScreenProps<AppStackParamList, 'Content'>) {
  const { user, request, download } = useAuth();
  const [content, setContent] = useState<TrainingContent | null>(null);
  const [progress, setProgress] = useState<ProgressSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingLessonId, setSavingLessonId] = useState<string>();
  const [resourceBusyId, setResourceBusyId] = useState<string>();
  const [focusedLessonId, setFocusedLessonId] = useState<string>();
  const { trainingId } = route.params;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextContent = await request<TrainingContent>(
        `/trainings/${trainingId}/content`,
      );
      setContent(nextContent);
      if (user?.role === 'LEARNER') {
        const page = await request<PaginatedProgress>(
          `/progress?trainingId=${trainingId}`,
        );
        setProgress(page.items[0]);
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [request, trainingId, user]);

  useEffect(() => {
    // Route entry synchronizes authorized content and server-calculated progress.
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const completed = useMemo(
    () =>
      new Map(
        progress?.lessons.map((lesson) => [lesson.lessonId, lesson.completed]),
      ),
    [progress],
  );

  async function toggleLesson(lessonId: string) {
    if (savingLessonId !== undefined || progress === undefined) return;
    setSavingLessonId(lessonId);
    setError('');
    setNotice('');
    try {
      const nextCompleted = !(completed.get(lessonId) ?? false);
      setProgress(
        await request<ProgressSummary>(`/progress/lessons/${lessonId}`, {
          method: 'PUT',
          body: JSON.stringify({ completed: nextCompleted }),
        }),
      );
      setNotice(
        nextCompleted
          ? 'Leçon marquée comme terminée.'
          : 'Progression mise à jour.',
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setSavingLessonId(undefined);
    }
  }

  async function openResource(resource: ContentResource) {
    setResourceBusyId(resource.id);
    setError('');
    try {
      if (
        resource.type === 'EXTERNAL_URL' &&
        resource.externalUrl !== undefined
      ) {
        await Linking.openURL(resource.externalUrl);
      } else if (resource.file !== undefined) {
        const uri = await download(
          `/resources/${resource.id}/download`,
          resource.file.originalName,
        );
        await shareFile(uri, resource.file.mimeType);
      }
    } catch (caught) {
      setError(message(caught));
    } finally {
      setResourceBusyId(undefined);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={() => void load()}
            refreshing={loading && content !== null}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heading}>
          {/* <Text style={styles.eyebrow}>CONTENU PROTÉGÉ</Text> */}
          <Text style={styles.title}>Contenu de la formation</Text>
        </View>
        <Notice message={error} />
        <Notice message={notice} success />
        {loading && content === null ? (
          <StatePanel loading message="Chargement du contenu…" />
        ) : content === null ? (
          <StatePanel
            message={error || 'Contenu indisponible.'}
            retry={() => void load()}
          />
        ) : (
          <>
            {content.access === 'MANAGE' && (
              <ContentManagementPanel
                content={content}
                reload={load}
                request={request}
              />
            )}
            {progress !== undefined && (
              <View style={styles.progressCard}>
                <Text style={styles.cardTitle}>{progress.training.title}</Text>
                <ProgressBar value={progress.percentage} />
                <Text style={styles.muted}>
                  {progress.completedLessonCount}/{progress.totalLessonCount}{' '}
                  leçon(s)
                </Text>
                {progress.lockedByCertificate && (
                  <Notice
                    message="Progression verrouillée après émission du certificat."
                    success
                  />
                )}
              </View>
            )}
            {user?.role === 'LEARNER' && content.access === 'LEARNER_READ' && (
              <TutorChat
                content={content}
                onOpenLesson={(lessonId) => {
                  setFocusedLessonId(lessonId);
                  setNotice(
                    'La leçon source a été ouverte dans le contenu ci-dessous.',
                  );
                }}
              />
            )}
            {content.modules.length === 0 ? (
              <StatePanel message="Aucun contenu disponible." />
            ) : (
              content.modules.map((module) => (
                <View key={module.id} style={styles.moduleCard}>
                  <Text style={styles.eyebrow}>MODULE {module.order}</Text>
                  <Text style={styles.cardTitle}>{module.title}</Text>
                  {module.description !== '' && (
                    <Text style={styles.muted}>{module.description}</Text>
                  )}
                  <View style={styles.lessons}>
                    {module.lessons.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        completed={completed.get(lesson.id) ?? false}
                        lesson={lesson}
                        locked={progress?.lockedByCertificate ?? true}
                        onOpenResource={(resource) =>
                          void openResource(resource)
                        }
                        onToggle={() => void toggleLesson(lesson.id)}
                        resourceBusyId={resourceBusyId}
                        saving={savingLessonId === lesson.id}
                        forceOpen={focusedLessonId === lesson.id}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ProgressScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Progress'>) {
  const { request } = useAuth();
  const [page, setPage] = useState<PaginatedProgress | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPage(
        await request<PaginatedProgress>(
          `/progress?page=${pageNumber}&pageSize=12`,
        ),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, request]);

  useEffect(() => {
    // Page changes synchronize with backend-owned progress summaries.
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
          <Text style={styles.eyebrow}>AUTOFORMATION</Text>
          <Text style={styles.title}>Ma progression</Text>
        </View>
        {loading && page === null ? (
          <StatePanel loading message="Chargement de votre progression…" />
        ) : error !== '' ? (
          <StatePanel message={error} retry={() => void load()} />
        ) : page === null || page.items.length === 0 ? (
          <StatePanel
            title="Aucune formation en ligne autonome"
            message="Une formation apparaîtra après confirmation de son paiement."
          />
        ) : (
          <>
            {page.items.map((item) => (
              <View key={item.enrollmentId} style={styles.progressCard}>
                <Text style={styles.eyebrow}>
                  {item.isComplete ? 'TERMINÉE' : 'EN COURS'}
                </Text>
                <Text style={styles.cardTitle}>{item.training.title}</Text>
                <ProgressBar value={item.percentage} />
                <Text style={styles.muted}>
                  {item.completedLessonCount}/{item.totalLessonCount} leçon(s)
                  terminée(s)
                </Text>
                <Button
                  label="Ouvrir le contenu"
                  onPress={() =>
                    navigation.navigate('Content', {
                      trainingId: item.training.id,
                    })
                  }
                />
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 40 },
  heading: { gap: spacing.xs, paddingVertical: spacing.sm },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 28, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  progressCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  moduleCard: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  lessons: { gap: spacing.md },
  lessonCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.canvas,
  },
  lessonCardFocused: { borderColor: colors.primary, borderWidth: 2 },
  lessonHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  lessonTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  expand: { color: colors.primary, fontSize: 26, fontWeight: '500' },
  lessonBody: {
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  bodyText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  instructions: {
    gap: spacing.xs,
    borderRadius: radii.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
  },
  resource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  resourceTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  resourceMeta: { color: colors.primary, fontSize: 12 },
  resourceAction: { width: 120 },
  pageText: { color: colors.muted, textAlign: 'center' },
});

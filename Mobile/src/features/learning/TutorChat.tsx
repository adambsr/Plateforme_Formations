import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import type {
  TrainingContent,
  TutorCitation,
  TutorMode,
  TutorResponse,
} from './types';

interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations?: TutorCitation[];
  grounded?: boolean;
  followUpQuestions?: string[];
}

const quickActions: Array<{ mode: TutorMode; label: string; prompt: string }> =
  [
    {
      mode: 'SIMPLIFY',
      label: 'Expliquer simplement',
      prompt: 'Explique-moi simplement les notions importantes de cette leçon.',
    },
    {
      mode: 'SUMMARY',
      label: 'Résumer',
      prompt: 'Résume les points essentiels à retenir.',
    },
    {
      mode: 'EXAMPLE',
      label: 'Donner un exemple',
      prompt: 'Donne-moi un exemple concret basé sur le cours.',
    },
    {
      mode: 'PRACTICE',
      label: 'M’entraîner',
      prompt:
        'Prépare quelques questions courtes pour vérifier ma compréhension.',
    },
    {
      mode: 'REVISION',
      label: 'Réviser',
      prompt: 'Aide-moi à réviser avant mon évaluation.',
    },
  ];

export function TutorChat({
  content,
  onOpenLesson,
}: {
  content: TrainingContent;
  onOpenLesson: (lessonId: string) => void;
}) {
  const { request } = useAuth();
  const nextId = useRef(1);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'ASSISTANT',
      content:
        'Bonjour ! Je réponds uniquement à partir de cette formation et je cite les leçons utilisées. Que souhaitez-vous travailler ?',
      grounded: true,
    },
  ]);
  const [draft, setDraft] = useState('');
  const [currentLessonId, setCurrentLessonId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(value: string, mode: TutorMode = 'QUESTION') {
    const trimmed = value.trim();
    if (trimmed.length < 2 || busy) return;
    const history = messages
      .filter(({ id }) => id !== 0)
      .slice(-8)
      .map(({ role, content: priorContent }) => ({
        role,
        content: priorContent,
      }));
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'USER', content: trimmed },
    ]);
    setDraft('');
    setBusy(true);
    setError('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await request<TutorResponse>(
        `/trainings/${content.trainingId}/tutor/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            mode,
            ...(currentLessonId === '' ? {} : { currentLessonId }),
            conversation: history,
          }),
          signal: controller.signal,
        },
      );
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: 'ASSISTANT',
          content: response.answer,
          citations: response.citations,
          grounded: response.grounded,
          followUpQuestions: response.followUpQuestions,
        },
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.name === 'AbortError'
          ? 'Le tuteur met trop de temps à répondre. Réessayez dans un instant.'
          : caught instanceof ApiError
            ? caught.message
            : 'Le tuteur est momentanément indisponible.',
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  const lessons = content.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ ...lesson, moduleTitle: module.title })),
  );
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>ASSISTANT PÉDAGOGIQUE</Text>
      <Text style={styles.title}>Tuteur IA de la formation</Text>
      <Text style={styles.muted}>
        Réponses limitées au contenu du cours, avec sources vérifiables.
      </Text>
      <Text style={styles.label}>Leçon à privilégier</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <LessonChip
          label="Toute la formation"
          selected={currentLessonId === ''}
          onPress={() => setCurrentLessonId('')}
        />
        {lessons.map((lesson) => (
          <LessonChip
            key={lesson.id}
            label={`${lesson.moduleTitle} · ${lesson.title}`}
            selected={currentLessonId === lesson.id}
            onPress={() => setCurrentLessonId(lesson.id)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {quickActions.map((action) => (
          <Pressable
            key={action.mode}
            disabled={busy}
            onPress={() => void send(action.prompt, action.mode)}
            style={styles.quick}
          >
            <Text style={styles.quickText}>{action.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.messages}>
        {messages.map((item) => (
          <View
            key={item.id}
            style={[
              styles.message,
              item.role === 'USER' ? styles.user : styles.assistant,
            ]}
          >
            <Text style={styles.author}>
              {item.role === 'USER' ? 'Vous' : 'Tuteur IA'}
            </Text>
            <Text style={styles.body}>{item.content}</Text>
            {item.grounded === false && (
              <Text style={styles.warning}>
                Le contenu disponible ne permet pas de confirmer cette réponse.
              </Text>
            )}
            {item.citations !== undefined && item.citations.length > 0 && (
              <View style={styles.sources}>
                <Text style={styles.sourceLabel}>Sources du cours</Text>
                {item.citations.map((citation) => (
                  <Pressable
                    key={citation.lessonId}
                    onPress={() => onOpenLesson(citation.lessonId)}
                  >
                    <Text style={styles.link}>
                      {citation.moduleTitle} · {citation.lessonTitle}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {item.followUpQuestions?.map((question) => (
              <Pressable
                key={question}
                disabled={busy}
                onPress={() => void send(question)}
              >
                <Text style={styles.followUp}>{question}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        {busy && (
          <Text style={styles.thinking}>
            Le tuteur recherche dans les leçons…
          </Text>
        )}
      </View>
      {error !== '' && <Text style={styles.error}>{error}</Text>}
      <TextField
        label="Votre question"
        value={draft}
        onChangeText={setDraft}
        maxLength={2000}
        multiline
        numberOfLines={3}
        placeholder="Ex. Peux-tu reformuler cette notion avec un exemple ?"
      />
      <Button
        label="Envoyer"
        loading={busy}
        disabled={draft.trim().length < 2}
        onPress={() => void send(draft)}
      />
      <Text style={styles.disclaimer}>
        L’IA peut se tromper : utilisez les sources pour vérifier dans le cours.
        Ne partagez aucune donnée personnelle ou de paiement.
      </Text>
    </View>
  );
}

function LessonChip({
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
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: {
    maxWidth: 230,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: { color: colors.muted, fontSize: 13 },
  chipTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  quick: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  quickText: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
  messages: { gap: spacing.md },
  message: {
    gap: spacing.sm,
    minWidth: 0,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  user: { marginLeft: spacing.xl, backgroundColor: colors.primarySoft },
  assistant: { marginRight: spacing.md, backgroundColor: colors.canvas },
  author: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21, flexShrink: 1 },
  warning: { color: colors.danger, fontSize: 12 },
  sources: { gap: spacing.sm, minWidth: 0 },
  sourceLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  link: { color: colors.primary, fontWeight: '700' },
  followUp: {
    color: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.sm,
    flexShrink: 1,
  },
  thinking: { color: colors.muted, fontStyle: 'italic' },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});

import { useLinkTo } from '@react-navigation/native';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, apiClient } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { TextField } from '../../shared/components/TextField';
import { colors, radii, spacing } from '../../shared/theme/tokens';

interface ConciergeLink {
  label: string;
  href: string;
}
interface ConciergeResponse {
  answer: string;
  grounded: boolean;
  sources: Array<{ id: string; title: string; href: string }>;
  actions: ConciergeLink[];
  suggestedQuestions: string[];
}
interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
  grounded?: boolean;
  sources?: ConciergeResponse['sources'];
  actions?: ConciergeLink[];
  suggestedQuestions?: string[];
}

const starters = [
  'Quelles formations proposez-vous ?',
  'Comment créer un compte ?',
  'Comment fonctionne le paiement ?',
];

export function PublicConcierge() {
  const { status } = useAuth();
  const linkTo = useLinkTo();
  const nextId = useRef(1);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'ASSISTANT',
      content:
        'Bonjour 👋 Je peux vous aider à découvrir nos formations et à trouver les bonnes pages. Que recherchez-vous ?',
      grounded: true,
    },
  ]);

  if (status !== 'guest') return null;

  async function send(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2 || busy) return;
    const conversation = messages
      .filter(({ id }) => id !== 0)
      .slice(-4)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      { id: nextId.current++, role: 'USER', content: trimmed },
    ]);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const response = await apiClient.request<ConciergeResponse>(
        '/public/concierge/messages',
        {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            currentPath: '/',
            conversation,
          }),
        },
      );
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          role: 'ASSISTANT',
          content: response.answer,
          grounded: response.grounded,
          sources: response.sources,
          actions: response.actions,
          suggestedQuestions: response.suggestedQuestions,
        },
      ]);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 429
          ? 'Vous avez envoyé plusieurs messages. Réessayez dans quelques minutes.'
          : caught instanceof ApiError
            ? caught.message
            : 'L’assistant est momentanément indisponible.',
      );
    } finally {
      setBusy(false);
    }
  }

  function openPath(href: string) {
    setOpen(false);
    linkTo(href.replace(/^\/app/, '') || '/');
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Ouvrir l’assistant HSA"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.launcher}
      >
        <Text style={styles.launcherIcon}>✦</Text>
        <Text style={styles.launcherText}>Besoin d’aide ?</Text>
      </Pressable>
      <Modal
        animationType="slide"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>ASSISTANT PUBLIC</Text>
                <Text style={styles.title}>Concierge HSA</Text>
              </View>
              <Button
                label="Fermer"
                variant="link"
                onPress={() => setOpen(false)}
              />
            </View>
            <ScrollView
              contentContainerStyle={styles.messages}
              keyboardShouldPersistTaps="handled"
            >
              {messages.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.message,
                    item.role === 'USER' ? styles.user : styles.assistant,
                  ]}
                >
                  <Text style={styles.author}>
                    {item.role === 'USER' ? 'Vous' : 'Assistant HSA'}
                  </Text>
                  <Text style={styles.body}>{item.content}</Text>
                  {item.grounded === false && (
                    <Text style={styles.warning}>
                      Je n’ai pas trouvé cette information dans les sources
                      publiques.
                    </Text>
                  )}
                  {item.sources?.map((source) => (
                    <Pressable
                      key={source.id}
                      onPress={() => openPath(source.href)}
                    >
                      <Text style={styles.link}>Source · {source.title}</Text>
                    </Pressable>
                  ))}
                  {item.actions?.map((action) => (
                    <Button
                      key={action.href}
                      label={action.label}
                      variant="secondary"
                      onPress={() => openPath(action.href)}
                    />
                  ))}
                  {item.suggestedQuestions?.map((question) => (
                    <Pressable
                      key={question}
                      disabled={busy}
                      onPress={() => void send(question)}
                    >
                      <Text style={styles.suggestion}>{question}</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
              {messages.length === 1 &&
                starters.map((question) => (
                  <Button
                    key={question}
                    label={question}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void send(question)}
                  />
                ))}
              {busy && (
                <Text style={styles.thinking}>
                  Je consulte les informations publiques…
                </Text>
              )}
              {error !== '' && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <View style={styles.composer}>
              <TextField
                label="Votre question"
                value={draft}
                maxLength={1000}
                multiline
                onChangeText={setDraft}
                placeholder="Posez votre question…"
              />
              <Button
                label="Envoyer"
                loading={busy}
                disabled={draft.trim().length < 2}
                onPress={() => void send(draft)}
              />
              <Text style={styles.disclaimer}>
                Votre question est traitée par Gemini. Ne partagez ni mot de
                passe ni données bancaires. L’IA peut se tromper.
              </Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  launcher: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 28,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryDark,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  launcherIcon: { color: colors.surface, fontSize: 22 },
  launcherText: { color: colors.surface, fontWeight: '800' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800' },
  messages: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl },
  message: {
    gap: spacing.sm,
    maxWidth: '92%',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  user: { alignSelf: 'flex-end', backgroundColor: colors.primarySoft },
  assistant: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  author: { color: colors.primaryDark, fontSize: 12, fontWeight: '800' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  warning: { color: colors.danger, fontSize: 12 },
  link: { color: colors.primary, fontWeight: '700' },
  suggestion: {
    color: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  thinking: { color: colors.muted, fontStyle: 'italic' },
  error: { color: colors.danger },
  composer: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});

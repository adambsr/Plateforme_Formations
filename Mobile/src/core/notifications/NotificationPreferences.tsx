import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { useAuth } from '../auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import {
  declinePushNotifications,
  enablePushNotifications,
  notificationPermissionState,
} from './firebase-messaging';

const authPromptShownKey = 'notification-auth-prompt-shown';

export function NotificationPreferences({
  autoPrompt = false,
}: {
  autoPrompt?: boolean;
}) {
  const { request } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'enabled' | 'denied' | 'undecided'>('undecided');
  const [promptVisible, setPromptVisible] = useState(false);

  useEffect(() => {
    void notificationPermissionState().then(async (next) => {
      setState(next);
      if (autoPrompt && next === 'undecided') {
        const alreadyShown = await SecureStore.getItemAsync(authPromptShownKey);
        if (alreadyShown !== 'true') {
          await SecureStore.setItemAsync(authPromptShownKey, 'true');
          setPromptVisible(true);
        }
      }
    });
  }, [autoPrompt]);

  async function enable() {
    setLoading(true);
    setMessage('');
    try {
      const enabled = await enablePushNotifications(request);
      setState(enabled ? 'enabled' : 'denied');
      setPromptVisible(false);
      setMessage(
        enabled
          ? 'Notifications activées sur cet appareil.'
          : 'Vous pouvez les autoriser depuis les réglages Android.',
      );
    } catch {
      setMessage('Impossible d’activer les notifications pour le moment.');
    } finally {
      setLoading(false);
    }
  }

  async function decline() {
    await declinePushNotifications();
    setState('denied');
    setPromptVisible(false);
    setMessage('Vous pourrez modifier ce choix dans les réglages Android.');
  }

  return (
    <View style={autoPrompt ? styles.promptHost : styles.card}>
      {!autoPrompt && <Text style={styles.title}>Notifications</Text>}
      {!autoPrompt && (
        <Text style={styles.body}>
          Recevez les informations importantes concernant vos formations et vos
          sessions.
        </Text>
      )}
      {!autoPrompt && message !== '' && (
        <Text style={styles.message}>{message}</Text>
      )}
      {!autoPrompt &&
        (state === 'enabled' ? (
          <Text style={styles.message}>
            Notifications activées sur cet appareil.
          </Text>
        ) : (
          <Button
            label="Gérer les notifications"
            loading={loading}
            onPress={() => void enable()}
          />
        ))}
      <Modal animationType="fade" transparent visible={promptVisible} onRequestClose={() => void decline()}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.title}>Restez informé(e)</Text>
            <Text style={styles.body}>Souhaitez-vous recevoir les informations importantes concernant vos formations et vos sessions ?</Text>
            <Button label="Activer les notifications" loading={loading} onPress={() => void enable()} />
            <Button label="Pas maintenant" variant="secondary" onPress={() => void decline()} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  promptHost: { position: 'absolute', width: 0, height: 0 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' as const },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  message: { color: colors.success, fontSize: 14, fontWeight: '600' as const },
  overlay: { flex: 1, justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(23,32,51,0.45)' },
  modal: { gap: spacing.lg, borderRadius: radii.md, padding: spacing.xl, backgroundColor: colors.surface },
});

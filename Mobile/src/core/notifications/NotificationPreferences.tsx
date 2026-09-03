import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import {
  declinePushNotifications,
  enablePushNotifications,
  notificationPermissionState,
} from './firebase-messaging';

export function NotificationPreferences() {
  const { request } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'enabled' | 'denied' | 'undecided'>('undecided');
  const [promptVisible, setPromptVisible] = useState(false);

  useEffect(() => {
    void notificationPermissionState().then((next) => {
      setState(next);
      setPromptVisible(next === 'undecided');
    });
  }, []);

  async function enable() {
    setLoading(true);
    setMessage('');
    try {
      const enabled = await enablePushNotifications(request);
      setState(enabled ? 'enabled' : 'denied');
      setPromptVisible(false);
      setMessage(
        enabled
          ? 'Notifications activÃ©es pour cet appareil.'
          : 'Vous pouvez les autoriser depuis les rÃ©glages Android.',
      );
    } catch {
      setMessage('Impossible dâ€™activer les notifications pour le moment.');
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
    <View style={styles.card}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.body}>
        Recevez les informations importantes concernant vos formations et vos
        sessions.
      </Text>
      {message !== '' && <Text style={styles.message}>{message}</Text>}
      {state === 'enabled' ? (
        <Text style={styles.message}>Notifications activées sur cet appareil.</Text>
      ) : (
        <Button label="Gérer les notifications" loading={loading} onPress={() => void enable()} />
      )}
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

import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import {
  canUseFirebaseAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
} from './firebase';

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!canUseFirebaseAnalytics()) return;
    void getAnalyticsConsent().then((value) => setVisible(value === undefined));
  }, []);
  if (!visible) return null;
  return (
    <Modal
      transparent
      animationType="fade"
      visible
      onRequestClose={() => undefined}
    >
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <Text style={styles.title}>Statistiques facultatives</Text>
          <Text style={styles.body}>
            Nous utilisons Firebase pour mesurer les recommandations de
            formation. Les événements ne contiennent ni nom, ni email, ni donnée
            de paiement.
          </Text>
          <Button
            label="Refuser"
            variant="secondary"
            onPress={() => {
              void setAnalyticsConsent('denied');
              setVisible(false);
            }}
          />
          <Button
            label="Accepter"
            onPress={() => {
              void setAnalyticsConsent('granted');
              setVisible(false);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(23,32,51,0.45)',
  },
  card: {
    gap: spacing.md,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  title: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});

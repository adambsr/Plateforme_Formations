import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../../shared/components/Button';
import { colors, spacing } from '../../shared/theme/tokens';
import {
  canUseFirebaseAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
  type AnalyticsConsent,
} from './firebase';

export function AnalyticsPreferences() {
  const [choice, setChoice] = useState<AnalyticsConsent>();
  useEffect(() => {
    void getAnalyticsConsent().then(setChoice);
  }, []);
  if (!canUseFirebaseAnalytics()) {
    return (
      <Text style={styles.text}>
        Les statistiques facultatives ne sont pas activées dans cet
        environnement.
      </Text>
    );
  }
  async function choose(value: 'granted' | 'denied') {
    await setAnalyticsConsent(value);
    setChoice(value);
  }
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Choix actuel :{' '}
        {choice === 'granted'
          ? 'acceptées'
          : choice === 'denied'
            ? 'refusées'
            : 'non défini'}
        .
      </Text>
      <Button
        label="Refuser les statistiques"
        variant="secondary"
        onPress={() => void choose('denied')}
      />
      <Button
        label="Accepter les statistiques"
        onPress={() => void choose('granted')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  text: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});

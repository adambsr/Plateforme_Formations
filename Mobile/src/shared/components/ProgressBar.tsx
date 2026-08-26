import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing } from '../theme/tokens';

export function ProgressBar({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.group} accessibilityLabel={`${normalized}% terminé`}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${normalized}%` }]} />
      </View>
      <Text style={styles.label}>{normalized}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  track: {
    height: 9,
    overflow: 'hidden',
    borderRadius: radii.sm,
    backgroundColor: colors.line,
  },
  fill: { height: '100%', backgroundColor: colors.primary },
  label: { color: colors.primaryDark, fontSize: 13, fontWeight: '700' },
});

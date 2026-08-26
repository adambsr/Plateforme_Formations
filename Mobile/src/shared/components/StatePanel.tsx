import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { colors, radii, spacing } from '../theme/tokens';

export function StatePanel({
  title,
  message,
  loading = false,
  retry,
}: {
  title?: string;
  message: string;
  loading?: boolean;
  retry?: () => void;
}) {
  return (
    <View
      style={styles.panel}
      accessibilityLiveRegion="polite"
      accessibilityRole={loading ? 'progressbar' : undefined}
    >
      {loading && <ActivityIndicator color={colors.primary} size="large" />}
      {title !== undefined && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.message}>{message}</Text>
      {retry !== undefined && (
        <Button label="Réessayer" onPress={retry} variant="secondary" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

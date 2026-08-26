import { StyleSheet, Text } from 'react-native';

import { colors, radii, spacing } from '../theme/tokens';

export function Notice({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  if (message === '') return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.notice, success ? styles.success : styles.error]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radii.sm,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft },
  success: { color: colors.success, backgroundColor: colors.successSoft },
});

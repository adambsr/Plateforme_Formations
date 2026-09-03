import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing } from '../theme/tokens';

export function ScrollToTopButton({
  visible,
  onPress,
}: {
  visible: boolean;
  onPress: () => void;
}) {
  if (!visible) return null;
  return (
    <Pressable
      accessibilityHint="Returns to the top of this page"
      accessibilityLabel="Back to top"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>^</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryDark,
    borderRadius: 999,
    backgroundColor: colors.primary,
    elevation: 5,
  },
  label: { color: colors.surface, fontSize: 27, fontWeight: '800' },
  pressed: { opacity: 0.82 },
});

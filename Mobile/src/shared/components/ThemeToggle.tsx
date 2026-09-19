import { Moon, Sun } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';
import { colors, radii, spacing } from '../theme/tokens';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useAppTheme();
  const dark = theme === 'dark';
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: dark }}
      accessibilityLabel={
        dark ? 'Activer le thème clair' : 'Activer le thème sombre'
      }
      hitSlop={8}
      onPress={() => void toggleTheme()}
      style={({ pressed }) => [
        compact ? styles.compact : styles.row,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        {dark ? (
          <Sun color={colors.primaryDark} size={19} />
        ) : (
          <Moon color={colors.primaryDark} size={19} />
        )}
      </View>
      {!compact && (
        <View style={styles.copy}>
          <Text style={styles.label}>Thème sombre</Text>
          <Text style={styles.hint}>{dark ? 'Activé' : 'Désactivé'}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  compact: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
  pressed: { opacity: 0.7 },
});

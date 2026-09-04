import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { colors, radii, spacing } from '../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';

export function Button({
  label,
  loading = false,
  variant = 'primary',
  disabled,
  icon: Icon,
  ...props
}: Omit<PressableProps, 'children'> & {
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: LucideIcon;
}) {
  const blocked = disabled === true || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !blocked && styles.pressed,
        blocked && styles.disabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.surface : colors.primary}
        />
      ) : (
        <>
          {Icon !== undefined && (
            <Icon
              color={variant === 'primary' ? colors.surface : colors.primary}
              size={18}
            />
          )}
          <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primary: { borderColor: colors.primary, backgroundColor: colors.primary },
  secondary: { borderColor: colors.line, backgroundColor: colors.surface },
  danger: {
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  link: {
    minHeight: 44,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
  label: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  primaryLabel: { color: colors.surface },
  secondaryLabel: { color: colors.primaryDark },
  dangerLabel: { color: colors.danger },
  linkLabel: { color: colors.primary },
});

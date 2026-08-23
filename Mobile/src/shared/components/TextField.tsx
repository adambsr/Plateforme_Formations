import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, radii, spacing } from '../theme/tokens';

export function TextField({
  label,
  error,
  secureTextEntry,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  const isPassword = secureTextEntry === true;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.control, error !== undefined && styles.invalid]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          secureTextEntry={isPassword && !visible}
          style={styles.input}
          {...props}
        />
        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
            }
            hitSlop={8}
            onPress={() => setVisible((value) => !value)}
          >
            <Text style={styles.toggle}>
              {visible ? 'Masquer' : 'Afficher'}
            </Text>
          </Pressable>
        )}
      </View>
      {error !== undefined && (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  control: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  invalid: { borderColor: colors.danger },
  input: {
    minWidth: 0,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 16,
  },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  error: { color: colors.danger, fontSize: 13 },
});

import { StyleSheet, Text, View } from 'react-native';

import { appConfig } from '../../core/config/environment';
import { colors, radii, spacing } from '../theme/tokens';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand} accessibilityLabel={appConfig.centerName}>
      <View style={styles.mark} accessibilityElementsHidden>
        <Text style={styles.markText}>HS</Text>
      </View>
      {!compact && <Text style={styles.name}>{appConfig.centerName}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: colors.primaryDark,
  },
  markText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  name: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
});

import { Image, Pressable, StyleSheet, View } from 'react-native';

import { appConfig } from '../../core/config/environment';
import { spacing } from '../theme/tokens';

export function Brand({
  compact = false,
  onPress,
}: {
  compact?: boolean;
  onPress?: () => void;
}) {
  const logo = (
    <Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={require('../../../../HSA_LOGO.png')}
      style={compact ? styles.compactLogo : styles.logo}
    />
  );
  return (
    <View style={styles.brand} accessibilityLabel={appConfig.centerName}>
      {onPress === undefined ? logo : <Pressable accessibilityLabel="Accueil public" onPress={onPress}>{logo}</Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: { width: 152, height: 56, marginHorizontal: spacing.xs },
  compactLogo: { width: 108, height: 42, marginHorizontal: spacing.xs },
});

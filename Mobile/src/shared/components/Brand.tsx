import { Image, Pressable, StyleSheet, View } from 'react-native';

import { appConfig } from '../../core/config/environment';

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
  logo: { width: 210, height: 76 },
  compactLogo: { width: 80, height: 44 },
});

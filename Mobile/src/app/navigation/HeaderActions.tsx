import { Bell, Menu, Search } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNotifications } from '../../core/notifications/NotificationProvider';
import { colors } from '../../shared/theme/tokens';
import { useDrawer } from './drawer-context';
import { navigationRef } from './navigation-ref';

function HeaderButton({
  label,
  onPress,
  children,
}: React.PropsWithChildren<{ label: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={5}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export function HeaderActions() {
  const { openDrawer } = useDrawer();
  const { unread } = useNotifications();
  return (
    <View style={styles.row}>
      <HeaderButton
        label="Rechercher"
        onPress={() => navigationRef.navigate('Search')}
      >
        <Search color={colors.primaryDark} size={21} />
      </HeaderButton>
      <HeaderButton
        label={
          unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
        }
        onPress={() => navigationRef.navigate('Notifications')}
      >
        <Bell color={colors.primaryDark} size={21} />
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </HeaderButton>
      <HeaderButton label="Ouvrir la navigation" onPress={openDrawer}>
        <Menu color={colors.primaryDark} size={22} />
      </HeaderButton>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: {
    minWidth: 42,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  pressed: { backgroundColor: colors.primarySoft },
  badge: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: colors.danger,
  },
  badgeText: { color: colors.onBrand, fontSize: 9, fontWeight: '900' },
});

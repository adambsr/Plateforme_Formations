import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardCheck,
  Home,
  LogOut,
  Menu,
  Bell,
  Search,
  Settings,
  UserRound,
  UsersRound,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { AppStackParamList } from '../../app/navigation/types';
import { navigationRef } from '../../app/navigation/navigation-ref';
import { useDrawer } from '../../app/navigation/drawer-context';
import { ApiError } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { NotificationPreferences } from '../../core/notifications/NotificationPreferences';
import { AnalyticsPreferences } from '../../core/analytics/AnalyticsPreferences';
import { Brand } from '../../shared/components/Brand';
import { Button } from '../../shared/components/Button';
import { TextField } from '../../shared/components/TextField';
import { ThemeToggle } from '../../shared/components/ThemeToggle';
import { useNotifications } from '../../core/notifications/NotificationProvider';
import { colors, radii, spacing } from '../../shared/theme/tokens';
import { RoleDashboardSummary } from './RoleDashboardSummary';
import { roleWorkspace } from './role-workspace';

function displayName(profile: { firstName?: string; lastName?: string }) {
  return (
    [profile.firstName, profile.lastName].filter(Boolean).join(' ') ||
    'Votre espace'
  );
}

function profileInitials(profile: { firstName?: string; lastName?: string }) {
  const initials = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .map((part) => part?.trim().charAt(0).toUpperCase())
    .join('');
  return initials || 'HSA';
}

function roleLabel(role: 'LEARNER' | 'TRAINER' | 'ADMIN') {
  if (role === 'ADMIN') return 'Administrateur';
  if (role === 'TRAINER') return 'Formateur';
  return 'Apprenant';
}

type DrawerEntry = {
  label: string;
  Icon: LucideIcon;
  route: keyof AppStackParamList;
  badge?: number;
};

export function WorkspaceScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Workspace'>) {
  const { user } = useAuth();
  const { openDrawer } = useDrawer();
  const { unread } = useNotifications();
  if (user === null) return null;
  const workspace = roleWorkspace(user.role);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel="Ouvrir la navigation"
          accessibilityHint="Ouvre les pages de votre espace"
          hitSlop={8}
          onPress={openDrawer}
          style={styles.iconButton}
        >
          <Menu color={colors.primaryDark} size={24} />
        </Pressable>
        <Brand compact onPress={() => navigation.navigate('Home')} />
        <View style={styles.barSpacer} />
        <Pressable
          accessibilityLabel="Rechercher"
          hitSlop={6}
          onPress={() => navigation.navigate('Search')}
          style={styles.iconButton}
        >
          <Search color={colors.primaryDark} size={21} />
        </Pressable>
        <Pressable
          accessibilityLabel={
            unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
          }
          hitSlop={6}
          onPress={() => navigation.navigate('Notifications')}
          style={styles.iconButton}
        >
          <Bell color={colors.primaryDark} size={21} />
          {unread > 0 && (
            <Text style={styles.notificationBadge}>
              {unread > 99 ? '99+' : unread}
            </Text>
          )}
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{workspace.eyebrow}</Text>
          <Text style={styles.title}>
            {workspace.title}, {displayName(user.profile)}
          </Text>
          <Text style={styles.description}>{workspace.description}</Text>
        </View>
        <RoleDashboardSummary navigation={navigation} />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Votre espace</Text>
          <Text style={styles.muted}>{user.email}</Text>
          <Text style={styles.muted}>
            Utilisez le menu pour accéder à vos formations, sessions et
            réglages.
          </Text>
          <Button
            label="Ouvrir les paramètres"
            variant="secondary"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function AuthenticatedDrawer() {
  const { user, logout } = useAuth();
  const { isOpen, closeDrawer } = useDrawer();
  const { unread } = useNotifications();
  const insets = useSafeAreaInsets();
  const drawerX = useState(() => new Animated.Value(-320))[0];
  useEffect(() => {
    if (isOpen) {
      Animated.timing(drawerX, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [drawerX, isOpen]);
  if (user === null || !isOpen) return null;
  const currentRoute = navigationRef.getCurrentRoute()?.name;
  const workspaceItems: DrawerEntry[] = [
    { label: 'Tableau de bord', Icon: Home, route: 'Workspace' },
    { label: 'Catalogue', Icon: BookOpen, route: 'Catalogue' },
    {
      label: 'Notifications',
      Icon: Bell,
      route: 'Notifications',
      badge: unread,
    },
  ];
  const activityItems: DrawerEntry[] = [
    ...(user.role === 'LEARNER'
      ? [
          {
            label: 'Ma progression',
            Icon: ChartNoAxesCombined,
            route: 'Progress' as const,
          },
          {
            label: 'Mes achats',
            Icon: WalletCards,
            route: 'Purchases' as const,
          },
        ]
      : [
          {
            label: 'Formations',
            Icon: BookOpen,
            route: 'ManagedTrainings' as const,
          },
        ]),
    {
      label: user.role === 'LEARNER' ? 'Mon planning' : 'Sessions',
      Icon: CalendarDays,
      route: 'Sessions',
    },
    {
      label: user.role === 'LEARNER' ? 'Mes présences' : 'Présences',
      Icon: ClipboardCheck,
      route: 'Attendance',
    },
    { label: 'Évaluations', Icon: ClipboardCheck, route: 'Evaluations' },
    { label: 'Certificats', Icon: BadgeCheck, route: 'Certificates' },
  ];
  const adminItems: DrawerEntry[] =
    user.role === 'ADMIN'
      ? [
          {
            label: 'Indicateurs',
            Icon: ChartNoAxesCombined,
            route: 'AdminDashboard',
          },
          { label: 'Utilisateurs', Icon: UsersRound, route: 'AdminUsers' },
          { label: 'Coûts', Icon: WalletCards, route: 'AdminCosts' },
          { label: 'Catégories', Icon: Settings, route: 'AdminCategories' },
        ]
      : [];
  const sections = [
    { label: 'ESPACE', items: workspaceItems },
    {
      label: user.role === 'LEARNER' ? 'APPRENTISSAGE' : 'GESTION',
      items: activityItems,
    },
    ...(adminItems.length > 0
      ? [{ label: 'ADMINISTRATION', items: adminItems }]
      : []),
  ];
  const accountItems: DrawerEntry[] = [
    { label: 'Mon profil', Icon: UserRound, route: 'Profile' },
    { label: 'Paramètres', Icon: Settings, route: 'Settings' },
  ];
  function close(after?: () => void) {
    Animated.timing(drawerX, {
      toValue: -320,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      closeDrawer();
      after?.();
    });
  }
  return (
    <>
      <Pressable
        accessibilityLabel="Fermer la navigation"
        style={styles.backdrop}
        onPress={() => close()}
      />
      <Animated.View
        style={[
          styles.drawer,
          {
            top: insets.top,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
          },
          { transform: [{ translateX: drawerX }] },
        ]}
      >
        <View style={styles.drawerHeader}>
          <Brand compact />
          <Pressable
            accessibilityLabel="Fermer la navigation"
            hitSlop={8}
            onPress={() => close()}
            style={styles.iconButton}
          >
            <X color={colors.ink} size={24} />
          </Pressable>
        </View>
        <View style={styles.drawerIdentity}>
          <View style={styles.drawerAvatar}>
            <Text style={styles.drawerAvatarText}>
              {profileInitials(user.profile)}
            </Text>
          </View>
          <View style={styles.drawerIdentityCopy}>
            <Text numberOfLines={1} style={styles.drawerIdentityName}>
              {displayName(user.profile)}
            </Text>
            <Text numberOfLines={1} style={styles.drawerIdentityRole}>
              {roleLabel(user.role)}
            </Text>
          </View>
        </View>
        <ScrollView
          style={styles.drawerScroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.drawerList}
        >
          {sections.map((section) => (
            <View key={section.label} style={styles.drawerSection}>
              <Text style={styles.drawerLabel}>{section.label}</Text>
              {section.items.map(({ label, Icon, route, badge }) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: currentRoute === route }}
                  onPress={() =>
                    close(() => navigationRef.navigate(route as never))
                  }
                  style={({ pressed }) => [
                    styles.drawerItem,
                    currentRoute === route && styles.drawerItemActive,
                    pressed && styles.drawerItemPressed,
                  ]}
                >
                  <Icon
                    color={
                      currentRoute === route ? colors.primaryDark : colors.muted
                    }
                    size={21}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.drawerText,
                      currentRoute === route && styles.drawerTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                  {badge !== undefined && badge > 0 && (
                    <Text style={styles.drawerBadge}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
        <View style={styles.drawerFooter}>
          {accountItems.map(({ label, Icon, route }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: currentRoute === route }}
              onPress={() =>
                close(() => navigationRef.navigate(route as never))
              }
              style={({ pressed }) => [
                styles.drawerItem,
                currentRoute === route && styles.drawerItemActive,
                pressed && styles.drawerItemPressed,
              ]}
            >
              <Icon
                color={
                  currentRoute === route ? colors.primaryDark : colors.muted
                }
                size={21}
              />
              <Text
                style={[
                  styles.drawerText,
                  currentRoute === route && styles.drawerTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.drawerDivider} />
          <Pressable
            accessibilityRole="button"
            onPress={() => close(() => void logout())}
            style={({ pressed }) => [
              styles.drawerItem,
              pressed && styles.drawerItemPressed,
            ]}
          >
            <LogOut color={colors.danger} size={21} />
            <Text style={styles.drawerLogout}>Se déconnecter</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

export function ProfileScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Profile'>) {
  const { user, updateProfile } = useAuth();
  const [firstName, setFirstName] = useState(user?.profile.firstName ?? '');
  const [lastName, setLastName] = useState(user?.profile.lastName ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  if (user === null) return null;
  async function submit() {
    if (!firstName.trim() || !lastName.trim())
      return setError('Renseignez votre prénom et votre nom.');
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await updateProfile(firstName, lastName);
      setMessage('Votre profil a été mis à jour.');
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Une erreur inattendue est survenue.',
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations personnelles</Text>
            <Text style={styles.muted}>{user.email}</Text>
            <TextField
              autoComplete="given-name"
              label="Prénom"
              onChangeText={setFirstName}
              returnKeyType="next"
              value={firstName}
            />
            <TextField
              autoComplete="family-name"
              label="Nom"
              onChangeText={setLastName}
              onSubmitEditing={() => void submit()}
              returnKeyType="done"
              value={lastName}
            />
            {error !== '' && (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            )}
            {message !== '' && (
              <Text style={styles.success} accessibilityLiveRegion="polite">
                {message}
              </Text>
            )}
            <Button
              label="Enregistrer"
              loading={loading}
              onPress={() => void submit()}
            />
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sécurité</Text>
            <Button
              label="Changer le mot de passe"
              variant="secondary"
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <Button
              label="Réinitialiser le mot de passe"
              variant="secondary"
              onPress={() => navigation.navigate('ResetPassword', {})}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'Settings'>) {
  const { logout } = useAuth();
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apparence</Text>
          <ThemeToggle />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <NotificationPreferences />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Statistiques facultatives</Text>
          <AnalyticsPreferences />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Compte et sécurité</Text>
          <Button
            label="Gérer mon profil"
            variant="secondary"
            onPress={() => navigation.navigate('Profile')}
          />
          <Button
            label="Se déconnecter"
            variant="danger"
            onPress={() => void logout()}
          />
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>À propos</Text>
          <Text style={styles.muted}>
            High Skills Academy · Application mobile
          </Text>
          <Button
            label="Voir l’accueil public"
            variant="link"
            onPress={() => navigation.navigate('Home')}
          />
          <Button
            label="Confidentialité"
            variant="link"
            onPress={() => navigation.navigate('Legal', { kind: 'privacy' })}
          />
          <Button
            label="Conditions générales"
            variant="link"
            onPress={() => navigation.navigate('Legal', { kind: 'terms' })}
          />
          <Button
            label="Cookies et traceurs"
            variant="link"
            onPress={() => navigation.navigate('Legal', { kind: 'cookies' })}
          />
          <Button
            label="Remboursements"
            variant="link"
            onPress={() => navigation.navigate('Legal', { kind: 'refunds' })}
          />
          <Button
            label="Demander la suppression du compte"
            variant="link"
            onPress={() => navigation.navigate('Legal', { kind: 'deletion' })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl },
  bar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  barSpacer: { flex: 1 },
  notificationBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 17,
    height: 17,
    overflow: 'hidden',
    borderRadius: 9,
    paddingHorizontal: 3,
    color: colors.onBrand,
    backgroundColor: colors.danger,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 17,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  hero: {
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.brandDeep,
  },
  eyebrow: {
    color: '#bcd8f5',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    color: colors.onBrand,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  description: { color: '#dbe7f5', fontSize: 15, lineHeight: 22 },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  success: {
    color: colors.success,
    backgroundColor: colors.successSoft,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,32,51,0.4)',
  },
  drawer: {
    position: 'absolute',
    zIndex: 2,
    top: 0,
    bottom: 0,
    width: 310,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.surface,
    elevation: 12,
  },
  drawerHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  drawerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.subtle,
  },
  drawerAvatar: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: colors.brandDeep,
  },
  drawerAvatarText: {
    color: colors.onBrand,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  drawerIdentityCopy: { flex: 1, gap: 2 },
  drawerIdentityName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  drawerIdentityRole: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  drawerScroll: { flex: 1 },
  drawerLabel: {
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  drawerList: { gap: spacing.lg, paddingVertical: spacing.sm },
  drawerSection: { gap: 2 },
  drawerItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  drawerItemActive: { backgroundColor: colors.primarySoft },
  drawerItemPressed: { opacity: 0.72 },
  drawerText: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '700' },
  drawerTextActive: { color: colors.primaryDark },
  drawerBadge: {
    minWidth: 22,
    height: 22,
    overflow: 'hidden',
    borderRadius: 11,
    paddingHorizontal: 5,
    color: colors.onBrand,
    backgroundColor: colors.danger,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 22,
    textAlign: 'center',
  },
  drawerFooter: {
    gap: 2,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  drawerDivider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    backgroundColor: colors.line,
  },
  drawerLogout: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});

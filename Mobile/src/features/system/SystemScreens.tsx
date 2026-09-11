import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type {
  AppStackParamList,
  GuestStackParamList,
  StatusKind,
} from '../../app/navigation/types';
import { Brand } from '../../shared/components/Brand';
import { Button } from '../../shared/components/Button';
import { colors, radii, spacing } from '../../shared/theme/tokens';

const copy: Record<
  StatusKind,
  { code: string; title: string; message: string }
> = {
  'not-found': {
    code: '404',
    title: 'Écran introuvable',
    message: 'Ce lien est incorrect, incomplet ou n’est plus disponible.',
  },
  'authentication-required': {
    code: '401',
    title: 'Connexion requise',
    message: 'Connectez-vous pour accéder à cette partie de l’application.',
  },
  forbidden: {
    code: '403',
    title: 'Accès non autorisé',
    message: 'Votre compte ne dispose pas des permissions nécessaires.',
  },
  'server-error': {
    code: '500',
    title: 'Une erreur est survenue',
    message:
      'L’écran n’a pas pu être affiché. Aucune information technique sensible n’est présentée.',
  },
  unavailable: {
    code: 'Hors ligne',
    title: 'Service indisponible',
    message: 'Vérifiez votre connexion réseau puis réessayez.',
  },
  'session-expired': {
    code: 'Session',
    title: 'Votre session a expiré',
    message:
      'Reconnectez-vous pour reprendre votre activité en toute sécurité.',
  },
  'account-unavailable': {
    code: 'Compte',
    title: 'Compte indisponible',
    message:
      'Ce compte est désactivé ou n’est plus accessible. Contactez le support si nécessaire.',
  },
  'resource-unavailable': {
    code: 'Indisponible',
    title: 'Ressource indisponible',
    message: 'Cette formation, ressource ou session n’est plus disponible.',
  },
};

export function SystemStatusView({
  kind,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  kind: StatusKind;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const item = copy[kind];
  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={styles.content}
        accessibilityRole={kind === 'server-error' ? 'alert' : undefined}
      >
        <Brand />
        <View style={styles.card}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          {primaryLabel !== undefined && onPrimary !== undefined && (
            <Button label={primaryLabel} onPress={onPrimary} />
          )}
          {secondaryLabel !== undefined && onSecondary !== undefined && (
            <Button
              label={secondaryLabel}
              onPress={onSecondary}
              variant="secondary"
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

export function GuestStatusScreen({
  navigation,
  route,
}: NativeStackScreenProps<GuestStackParamList, 'Status'>) {
  return (
    <SystemStatusView
      kind={route.params.kind}
      primaryLabel="Se connecter"
      onPrimary={() => navigation.navigate('Login')}
      secondaryLabel="Retour à l’accueil"
      onSecondary={() => navigation.navigate('Home')}
    />
  );
}

export function GuestNotFoundScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'NotFound'>) {
  return (
    <SystemStatusView
      kind="not-found"
      primaryLabel="Retour à l’accueil"
      onPrimary={() => navigation.navigate('Home')}
    />
  );
}

export function AppStatusScreen({
  navigation,
  route,
}: NativeStackScreenProps<AppStackParamList, 'Status'>) {
  return (
    <SystemStatusView
      kind={route.params.kind}
      primaryLabel="Tableau de bord"
      onPrimary={() => navigation.navigate('Workspace')}
    />
  );
}

export function AppNotFoundScreen({
  navigation,
}: NativeStackScreenProps<AppStackParamList, 'NotFound'>) {
  return (
    <SystemStatusView
      kind="not-found"
      primaryLabel="Tableau de bord"
      onPrimary={() => navigation.navigate('Workspace')}
    />
  );
}

interface BoundaryState {
  failed: boolean;
}
export class MobileErrorBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    if (this.state.failed)
      return (
        <SystemStatusView
          kind="server-error"
          primaryLabel="Réessayer"
          onPrimary={() => this.setState({ failed: false })}
        />
      );
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    gap: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  code: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});

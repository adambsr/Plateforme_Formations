import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type {
  AppStackParamList,
  GuestStackParamList,
  PasswordStackParamList,
} from '../../app/navigation/types';
import { ApiError, apiClient } from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Button } from '../../shared/components/Button';
import { TextField } from '../../shared/components/TextField';
import { colors, spacing } from '../../shared/theme/tokens';
import { AuthScaffold } from './AuthScaffold';
import {
  credentialsError,
  passwordChangeError,
  registrationError,
  resetPasswordError,
} from './validation';

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Une erreur inattendue est survenue.';
}

function AlertMessage({
  message,
  success = false,
}: {
  message: string;
  success?: boolean;
}) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.alert, success ? styles.success : styles.error]}
    >
      {message}
    </Text>
  );
}

export function LoginScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'Login'>) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const validation = credentialsError(email, password);
    if (validation !== null) return setError(validation);
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      title="Bienvenue"
      subtitle="Connectez-vous avec votre compte centre de formation."
    >
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <TextField
        autoComplete="current-password"
        label="Mot de passe"
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        returnKeyType="done"
        secureTextEntry
        textContentType="password"
        value={password}
      />
      {error !== '' && <AlertMessage message={error} />}
      <Button
        label="Se connecter"
        loading={loading}
        onPress={() => void submit()}
      />
      <View style={styles.actions}>
        <Button
          label="Mot de passe oublié ?"
          onPress={() => navigation.navigate('ForgotPassword')}
          variant="link"
        />
        <Button
          label="Créer un compte Apprenant"
          onPress={() => navigation.navigate('Register')}
          variant="secondary"
        />
        <Button
          label="Explorer le catalogue"
          onPress={() => navigation.navigate('Catalogue')}
          variant="link"
        />
      </View>
    </AuthScaffold>
  );
}

export function RegisterScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'Register'>) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const validation = registrationError({
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    });
    if (validation !== null) return setError(validation);
    setError('');
    setLoading(true);
    try {
      await register({ firstName, lastName, email, password });
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      title="Créer un compte Apprenant"
      subtitle="L’inscription publique crée exclusivement un compte Apprenant."
    >
      <TextField
        autoComplete="given-name"
        label="Prénom"
        onChangeText={setFirstName}
        value={firstName}
      />
      <TextField
        autoComplete="family-name"
        label="Nom"
        onChangeText={setLastName}
        value={lastName}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        textContentType="emailAddress"
        value={email}
      />
      <TextField
        autoComplete="new-password"
        label="Mot de passe"
        onChangeText={setPassword}
        secureTextEntry
        value={password}
      />
      <TextField
        autoComplete="new-password"
        label="Confirmer le mot de passe"
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
        secureTextEntry
        value={confirmPassword}
      />
      {error !== '' && <AlertMessage message={error} />}
      <Button
        label="Créer mon compte"
        loading={loading}
        onPress={() => void submit()}
      />
      <Button
        label="J’ai déjà un compte"
        onPress={() => navigation.navigate('Login')}
        variant="secondary"
      />
      <Button
        label="Retour au catalogue"
        onPress={() => navigation.navigate('Catalogue')}
        variant="link"
      />
    </AuthScaffold>
  );
}

export function ForgotPasswordScreen({
  navigation,
}: NativeStackScreenProps<GuestStackParamList, 'ForgotPassword'>) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.includes('@')) return setError('Saisissez un email valide.');
    setError('');
    setLoading(true);
    try {
      await apiClient.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          client: 'MOBILE',
        }),
      });
      setSent(true);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      title="Mot de passe oublié"
      subtitle="Nous enverrons un lien si un compte actif correspond à cet email."
    >
      {sent ? (
        <AlertMessage
          message="La demande a été prise en compte. Consultez votre boîte email."
          success
        />
      ) : (
        <>
          <TextField
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            onSubmitEditing={() => void submit()}
            value={email}
          />
          {error !== '' && <AlertMessage message={error} />}
          <Button
            label="Envoyer les instructions"
            loading={loading}
            onPress={() => void submit()}
          />
        </>
      )}
      <Button
        label="Retour à la connexion"
        onPress={() => navigation.navigate('Login')}
        variant="link"
      />
    </AuthScaffold>
  );
}

export function ResetPasswordScreen({
  navigation,
  route,
}: NativeStackScreenProps<GuestStackParamList, 'ResetPassword'>) {
  return (
    <ResetPasswordForm
      onReturn={() => navigation.navigate('Login')}
      token={route.params.token}
    />
  );
}

export function AuthenticatedResetPasswordScreen({
  route,
}: NativeStackScreenProps<AppStackParamList, 'ResetPassword'>) {
  const { logout } = useAuth();
  const clearSession = async () => {
    try {
      await logout();
    } catch {
      // logout always clears the local session in its finally block.
    }
  };
  return (
    <ResetPasswordForm
      afterReset={clearSession}
      onReturn={() => void clearSession()}
      token={route.params.token}
    />
  );
}

export function PasswordRequiredResetScreen({
  route,
}: NativeStackScreenProps<PasswordStackParamList, 'ResetPassword'>) {
  const { logout } = useAuth();
  const clearSession = async () => {
    try {
      await logout();
    } catch {
      // logout always clears the local session in its finally block.
    }
  };
  return (
    <ResetPasswordForm
      afterReset={clearSession}
      onReturn={() => void clearSession()}
      token={route.params.token}
    />
  );
}

function ResetPasswordForm({
  token,
  onReturn,
  afterReset,
}: {
  token?: string;
  onReturn: () => void;
  afterReset?: () => Promise<void>;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    const validation = resetPasswordError(newPassword, confirmPassword);
    if (validation !== null) return setError(validation);
    if (token === undefined || token.length < 20) {
      return setError('Le lien de réinitialisation est invalide ou incomplet.');
    }
    setLoading(true);
    setError('');
    try {
      await apiClient.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setComplete(true);
      await afterReset?.();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      title="Nouveau mot de passe"
      subtitle="Choisissez un nouveau mot de passe pour votre compte."
    >
      {complete ? (
        <AlertMessage
          message="Votre mot de passe a été réinitialisé."
          success
        />
      ) : (
        <>
          <TextField
            autoComplete="new-password"
            label="Nouveau mot de passe"
            onChangeText={setNewPassword}
            secureTextEntry
            value={newPassword}
          />
          <TextField
            autoComplete="new-password"
            label="Confirmer le mot de passe"
            onChangeText={setConfirmPassword}
            secureTextEntry
            value={confirmPassword}
          />
          {error !== '' && <AlertMessage message={error} />}
          <Button
            label="Réinitialiser"
            loading={loading}
            onPress={() => void submit()}
          />
        </>
      )}
      <Button label="Retour à la connexion" onPress={onReturn} variant="link" />
    </AuthScaffold>
  );
}

export function ChangePasswordScreen() {
  const { changePassword, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    const validation = passwordChangeError(
      currentPassword,
      newPassword,
      confirmPassword,
    );
    if (validation !== null) return setError(validation);
    setError('');
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold
      title="Modifier votre mot de passe"
      subtitle={
        user?.mustChangePassword === true
          ? 'Le mot de passe temporaire doit être remplacé avant de continuer.'
          : 'Cette opération déconnecte vos autres sessions.'
      }
    >
      <TextField
        label="Mot de passe actuel"
        onChangeText={setCurrentPassword}
        secureTextEntry
        value={currentPassword}
      />
      <TextField
        label="Nouveau mot de passe"
        onChangeText={setNewPassword}
        secureTextEntry
        value={newPassword}
      />
      <TextField
        label="Confirmer le mot de passe"
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
        secureTextEntry
        value={confirmPassword}
      />
      {error !== '' && <AlertMessage message={error} />}
      <Button
        label="Enregistrer"
        loading={loading}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  alert: {
    borderRadius: 9,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
  },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft },
  success: { color: colors.success, backgroundColor: colors.successSoft },
});

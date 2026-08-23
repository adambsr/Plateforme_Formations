import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../../core/auth/AuthContext';
import {
  ChangePasswordScreen,
  ForgotPasswordScreen,
  LoginScreen,
  RegisterScreen,
} from '../../features/auth/AuthScreens';
import {
  ProfileScreen,
  WorkspaceScreen,
} from '../../features/workspace/WorkspaceScreens';
import { ScreenMessage } from '../../shared/components/ScreenMessage';
import { colors } from '../../shared/theme/tokens';
import type {
  AppStackParamList,
  GuestStackParamList,
  PasswordStackParamList,
} from './types';

const GuestStack = createNativeStackNavigator<GuestStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const PasswordStack = createNativeStackNavigator<PasswordStackParamList>();

const screenOptions = {
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.ink,
  contentStyle: { backgroundColor: colors.canvas },
};

export function RootNavigator() {
  const { status, user } = useAuth();
  if (status === 'loading') {
    return <ScreenMessage message="Chargement de votre session…" />;
  }
  if (user === null) {
    return (
      <GuestStack.Navigator screenOptions={{ headerShown: false }}>
        <GuestStack.Screen name="Login" component={LoginScreen} />
        <GuestStack.Screen name="Register" component={RegisterScreen} />
        <GuestStack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
        />
      </GuestStack.Navigator>
    );
  }
  if (user.mustChangePassword) {
    return (
      <PasswordStack.Navigator screenOptions={{ headerShown: false }}>
        <PasswordStack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
        />
      </PasswordStack.Navigator>
    );
  }
  return (
    <AppStack.Navigator screenOptions={screenOptions}>
      <AppStack.Screen
        name="Workspace"
        component={WorkspaceScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Mon profil' }}
      />
    </AppStack.Navigator>
  );
}

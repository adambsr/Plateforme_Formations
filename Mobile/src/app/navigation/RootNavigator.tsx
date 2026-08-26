import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../../core/auth/AuthContext';
import {
  ChangePasswordScreen,
  ForgotPasswordScreen,
  LoginScreen,
  AuthenticatedResetPasswordScreen,
  PasswordRequiredResetScreen,
  RegisterScreen,
  ResetPasswordScreen,
} from '../../features/auth/AuthScreens';
import {
  AppCatalogueScreen,
  AppTrainingDetailScreen,
  GuestCatalogueScreen,
  GuestTrainingDetailScreen,
} from '../../features/trainings/TrainingScreens';
import { ManagedTrainingsScreen } from '../../features/trainings/ManagedTrainingsScreen';
import {
  ContentScreen,
  ProgressScreen,
} from '../../features/learning/LearningScreens';
import {
  SessionDetailScreen,
  SessionsScreen,
} from '../../features/sessions/SessionScreens';
import { SessionManagementScreen } from '../../features/sessions/SessionManagementScreen';
import {
  CheckoutReturnScreen,
  PurchasesScreen,
} from '../../features/payments/PaymentScreens';
import {
  EvaluationCreateScreen,
  EvaluationsScreen,
} from '../../features/evaluations/EvaluationScreens';
import { CertificatesScreen } from '../../features/certificates/CertificateScreens';
import { AttendanceScreen } from '../../features/attendance/AttendanceScreen';
import { AdminDashboardScreen } from '../../features/admin/AdminDashboardScreen';
import { AdminUsersScreen } from '../../features/admin/AdminUsersScreen';
import { AdminCostsScreen } from '../../features/admin/AdminCostsScreen';
import { AdminCategoriesScreen } from '../../features/admin/AdminCategoriesScreen';
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
      <GuestStack.Navigator
        initialRouteName="Catalogue"
        screenOptions={screenOptions}
      >
        <GuestStack.Screen
          name="Catalogue"
          component={GuestCatalogueScreen}
          options={{ headerShown: false }}
        />
        <GuestStack.Screen
          name="TrainingDetail"
          component={GuestTrainingDetailScreen}
          options={{ title: 'Formation' }}
        />
        <GuestStack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <GuestStack.Screen
          name="Register"
          component={RegisterScreen}
          options={{ headerShown: false }}
        />
        <GuestStack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
          options={{ headerShown: false }}
        />
        <GuestStack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ headerShown: false }}
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
      <PasswordStack.Screen
        name="ResetPassword"
        component={PasswordRequiredResetScreen}
      />
      <AppStack.Screen
        name="Catalogue"
        component={AppCatalogueScreen}
        options={{ title: 'Catalogue' }}
      />
      <AppStack.Screen
        name="TrainingDetail"
        component={AppTrainingDetailScreen}
        options={{ title: 'Formation' }}
      />
      <AppStack.Screen
        name="ManagedTrainings"
        component={ManagedTrainingsScreen}
        options={{ title: 'Formations gérées' }}
      />
      <AppStack.Screen
        name="Content"
        component={ContentScreen}
        options={{ title: 'Contenu' }}
      />
      <AppStack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: 'Ma progression' }}
      />
      <AppStack.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{ title: 'Sessions' }}
      />
      <AppStack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{ title: 'Détail de la session' }}
      />
      <AppStack.Screen
        name="SessionManage"
        component={SessionManagementScreen}
        options={{ title: 'Gestion de Session' }}
      />
      <AppStack.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: 'Présences' }}
      />
      <AppStack.Screen
        name="Purchases"
        component={PurchasesScreen}
        options={{ title: 'Achats et factures' }}
      />
      <AppStack.Screen
        name="CheckoutReturn"
        component={CheckoutReturnScreen}
        options={{ title: 'Paiement' }}
      />
      <AppStack.Screen
        name="ResetPassword"
        component={AuthenticatedResetPasswordScreen}
        options={{ headerShown: false }}
      />
      <AppStack.Screen
        name="Evaluations"
        component={EvaluationsScreen}
        options={{ title: 'Évaluations' }}
      />
      <AppStack.Screen
        name="EvaluationCreate"
        component={EvaluationCreateScreen}
        options={{ title: 'Nouvelle évaluation' }}
      />
      <AppStack.Screen
        name="Certificates"
        component={CertificatesScreen}
        options={{ title: 'Certificats' }}
      />
      <AppStack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Tableau de bord' }}
      />
      <AppStack.Screen
        name="AdminUsers"
        component={AdminUsersScreen}
        options={{ title: 'Utilisateurs' }}
      />
      <AppStack.Screen
        name="AdminCosts"
        component={AdminCostsScreen}
        options={{ title: 'Coûts' }}
      />
      <AppStack.Screen
        name="AdminCategories"
        component={AdminCategoriesScreen}
        options={{ title: 'Catégories' }}
      />
      <AppStack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Mon profil' }}
      />
    </AppStack.Navigator>
  );
}

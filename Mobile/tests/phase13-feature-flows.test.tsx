import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type {
  AppStackParamList,
  GuestStackParamList,
} from '../src/app/navigation/types';
import { useAuth, type AuthContextValue } from '../src/core/auth/AuthContext';
import type { UserRole } from '../src/core/auth/types';
import { LoginScreen, RegisterScreen } from '../src/features/auth/AuthScreens';
import { AttendanceScreen } from '../src/features/attendance/AttendanceScreen';
import { CertificatesScreen } from '../src/features/certificates/CertificateScreens';
import { EvaluationsScreen } from '../src/features/evaluations/EvaluationScreens';
import {
  ContentScreen,
  ProgressScreen,
} from '../src/features/learning/LearningScreens';
import { PurchasesScreen } from '../src/features/payments/PaymentScreens';
import { SessionsScreen } from '../src/features/sessions/SessionScreens';

jest.mock('../src/core/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);
const emptyPage = { items: [], page: 1, pageSize: 12, total: 0 };

function authContext(
  role: UserRole,
  request: jest.Mock = jest.fn(),
): AuthContextValue {
  return {
    status: 'authenticated',
    user: {
      id: '507f1f77bcf86cd799439011',
      email: `${role.toLowerCase()}@example.test`,
      role,
      isActive: true,
      mustChangePassword: false,
      profile: { firstName: 'Test', lastName: role },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    updateProfile: jest.fn(),
    request,
    download: jest.fn(),
  } as AuthContextValue;
}

function appProps<Name extends keyof AppStackParamList>(
  name: Name,
  params?: AppStackParamList[Name],
) {
  return {
    navigation: { navigate: jest.fn() },
    route: { key: `test-${name}`, name, params },
  } as unknown as NativeStackScreenProps<AppStackParamList, Name>;
}

function guestProps<Name extends keyof GuestStackParamList>(name: Name) {
  return {
    navigation: { navigate: jest.fn() },
    route: { key: `test-${name}`, name },
  } as unknown as NativeStackScreenProps<GuestStackParamList, Name>;
}

describe('Phase 13 Mobile feature flows', () => {
  afterEach(() => jest.clearAllMocks());

  it('submits login and learner-only registration through the auth provider', async () => {
    const context = authContext('LEARNER');
    mockedUseAuth.mockReturnValue(context);
    const login = await render(<LoginScreen {...guestProps('Login')} />);

    await fireEvent.changeText(
      login.getByLabelText('Email'),
      'learner@example.test',
    );
    await fireEvent.changeText(
      login.getByLabelText('Mot de passe'),
      'Password123!',
    );
    await fireEvent.press(login.getByText('Se connecter'));
    await waitFor(() =>
      expect(context.login).toHaveBeenCalledWith(
        'learner@example.test',
        'Password123!',
      ),
    );
    await login.unmount();

    const registration = await render(
      <RegisterScreen {...guestProps('Register')} />,
    );
    await fireEvent.changeText(registration.getByLabelText('Prénom'), 'Leila');
    await fireEvent.changeText(registration.getByLabelText('Nom'), 'Learner');
    await fireEvent.changeText(
      registration.getByLabelText('Email'),
      'leila@example.test',
    );
    await fireEvent.changeText(
      registration.getByLabelText('Mot de passe'),
      'Password123!',
    );
    await fireEvent.changeText(
      registration.getByLabelText('Confirmer le mot de passe'),
      'Password123!',
    );
    await fireEvent.press(registration.getByText('Créer mon compte'));

    await waitFor(() =>
      expect(context.register).toHaveBeenCalledWith({
        firstName: 'Leila',
        lastName: 'Learner',
        email: 'leila@example.test',
        password: 'Password123!',
      }),
    );
  });

  it('loads protected content and backend-calculated learner progress', async () => {
    const request = jest.fn(async (path: string) => {
      if (path === '/trainings/training-1/content') {
        return {
          trainingId: 'training-1',
          access: 'LEARNER_READ',
          modules: [],
        };
      }
      if (path === '/progress?trainingId=training-1') return emptyPage;
      throw new Error(`Unexpected request: ${path}`);
    });
    mockedUseAuth.mockReturnValue(authContext('LEARNER', request));
    const screen = await render(
      <ContentScreen {...appProps('Content', { trainingId: 'training-1' })} />,
    );

    expect(await screen.findByText('Aucun contenu disponible.')).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/trainings/training-1/content');
    expect(request).toHaveBeenCalledWith('/progress?trainingId=training-1');
  });

  it('handles progress loading, empty, and API error states', async () => {
    const pendingRequest = jest.fn(() => new Promise(() => undefined));
    mockedUseAuth.mockReturnValue(authContext('LEARNER', pendingRequest));
    const loading = await render(<ProgressScreen {...appProps('Progress')} />);
    expect(loading.getByText(/Chargement/)).toBeTruthy();
    await loading.unmount();

    const emptyRequest = jest.fn().mockResolvedValue(emptyPage);
    mockedUseAuth.mockReturnValue(authContext('LEARNER', emptyRequest));
    const empty = await render(<ProgressScreen {...appProps('Progress')} />);
    expect(
      await empty.findByText('Aucune formation en ligne autonome'),
    ).toBeTruthy();
    expect(emptyRequest).toHaveBeenCalledWith('/progress?page=1&pageSize=12');
    await empty.unmount();

    const failingRequest = jest.fn().mockRejectedValue(new Error('Panne test'));
    mockedUseAuth.mockReturnValue(authContext('LEARNER', failingRequest));
    const failed = await render(<ProgressScreen {...appProps('Progress')} />);
    expect(await failed.findByText('Panne test')).toBeTruthy();
  });

  it('uses enrolled Sessions for learner planning', async () => {
    const request = jest.fn().mockResolvedValue(emptyPage);
    mockedUseAuth.mockReturnValue(authContext('LEARNER', request));
    const screen = await render(<SessionsScreen {...appProps('Sessions')} />);

    expect(await screen.findByText(/Aucune session/)).toBeTruthy();
    expect(request).toHaveBeenCalledWith(
      '/sessions?view=ENROLLED&page=1&pageSize=12',
    );
  });

  it('uses managed Sessions for Trainer attendance', async () => {
    const request = jest.fn().mockResolvedValue(emptyPage);
    mockedUseAuth.mockReturnValue(authContext('TRAINER', request));
    const screen = await render(<AttendanceScreen />);

    expect(await screen.findByText(/Aucune session/)).toBeTruthy();
    expect(request).toHaveBeenCalledWith(
      '/sessions?view=MANAGED&page=1&pageSize=12',
    );
  });

  it('loads backend-confirmed payments and invoices', async () => {
    const request = jest.fn().mockResolvedValue(emptyPage);
    mockedUseAuth.mockReturnValue(authContext('LEARNER', request));
    const screen = await render(<PurchasesScreen {...appProps('Purchases')} />);

    expect((await screen.findAllByText(/^Aucune/)).length).toBe(2);
    expect(request).toHaveBeenCalledWith('/payments?page=1&pageSize=10');
    expect(request).toHaveBeenCalledWith('/invoices?page=1&pageSize=10');
  });

  it('loads learner evaluations and paid enrollment prerequisites', async () => {
    const request = jest.fn().mockResolvedValue(emptyPage);
    mockedUseAuth.mockReturnValue(authContext('LEARNER', request));
    const screen = await render(
      <EvaluationsScreen {...appProps('Evaluations')} />,
    );

    expect(await screen.findByText('Aucune évaluation')).toBeTruthy();
    expect(request).toHaveBeenCalledWith(
      '/evaluations?view=ACCESSIBLE&status=PUBLISHED&page=1&pageSize=12',
    );
    expect(request).toHaveBeenCalledWith('/enrollments?pageSize=100');
  });

  it('loads certificates and backend eligibility for the learner', async () => {
    const request = jest.fn().mockResolvedValue(emptyPage);
    mockedUseAuth.mockReturnValue(authContext('LEARNER', request));
    const screen = await render(<CertificatesScreen />);

    expect(await screen.findByText(/Aucun certificat/)).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/certificates?page=1&pageSize=100');
    expect(request).toHaveBeenCalledWith('/enrollments?page=1&pageSize=100');
  });
});

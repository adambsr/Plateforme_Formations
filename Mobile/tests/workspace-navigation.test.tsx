import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render } from '@testing-library/react-native';

import type { AppStackParamList } from '../src/app/navigation/types';
import { useAuth, type AuthContextValue } from '../src/core/auth/AuthContext';
import type { UserRole } from '../src/core/auth/types';
import { WorkspaceScreen } from '../src/features/workspace/WorkspaceScreens';

jest.mock('../src/core/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);

function context(role: UserRole): AuthContextValue {
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
    request: jest.fn(),
    download: jest.fn(),
  };
}

function props(navigate: jest.Mock) {
  return {
    navigation: { navigate },
    route: { key: 'workspace', name: 'Workspace' },
  } as unknown as NativeStackScreenProps<AppStackParamList, 'Workspace'>;
}

describe('Workspace role navigation', () => {
  it('shows Admin operations and navigates to the backend dashboard', async () => {
    const navigate = jest.fn();
    mockedUseAuth.mockReturnValue(context('ADMIN'));
    const screen = await render(<WorkspaceScreen {...props(navigate)} />);

    fireEvent.press(screen.getByText('Tableau de bord'));
    expect(navigate).toHaveBeenCalledWith('AdminDashboard');
    expect(screen.getByText('Formateurs et apprenants')).toBeTruthy();
    expect(screen.getByText('Coûts explicites')).toBeTruthy();
  });

  it('does not expose Admin operations to a Learner', async () => {
    mockedUseAuth.mockReturnValue(context('LEARNER'));
    const screen = await render(<WorkspaceScreen {...props(jest.fn())} />);

    expect(screen.queryByText('Formateurs et apprenants')).toBeNull();
    expect(screen.queryByText('Coûts explicites')).toBeNull();
    expect(screen.getByText('Ma progression')).toBeTruthy();
  });
});

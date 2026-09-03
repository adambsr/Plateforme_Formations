import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';

import type { AppStackParamList } from '../src/app/navigation/types';
import { useAuth, type AuthContextValue } from '../src/core/auth/AuthContext';
import type { UserRole } from '../src/core/auth/types';
import { WorkspaceScreen } from '../src/features/workspace/WorkspaceScreens';

jest.mock('../src/core/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const mockedUseAuth = jest.mocked(useAuth);

function context(role: UserRole): AuthContextValue {
  return {
    status: 'authenticated',
    user: { id: 'u1', email: 'user@example.test', role, isActive: true, mustChangePassword: false, profile: { firstName: 'Test', lastName: role }, createdAt: '', updatedAt: '' },
    login: jest.fn(), register: jest.fn(), logout: jest.fn(), changePassword: jest.fn(), updateProfile: jest.fn(), request: jest.fn(), download: jest.fn(),
  };
}

function props() {
  return { navigation: { navigate: jest.fn() }, route: { key: 'workspace', name: 'Workspace' } } as unknown as NativeStackScreenProps<AppStackParamList, 'Workspace'>;
}

describe('Workspace role navigation', () => {
  it('uses an accessible drawer trigger instead of a repeated button list', async () => {
    mockedUseAuth.mockReturnValue(context('ADMIN'));
    const screen = await render(<WorkspaceScreen {...props()} />);
    expect(screen.getByLabelText('Ouvrir la navigation')).toBeTruthy();
    expect(screen.getByText('Ouvrir les paramètres')).toBeTruthy();
    expect(screen.queryByText('Coûts explicites')).toBeNull();
  });

  it('keeps role-specific admin pages out of the learner dashboard', async () => {
    mockedUseAuth.mockReturnValue(context('LEARNER'));
    const screen = await render(<WorkspaceScreen {...props()} />);
    expect(screen.queryByText('Indicateurs')).toBeNull();
  });
});

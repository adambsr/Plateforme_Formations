import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { destinationForBackendLink } from '../src/app/navigation/backend-link';
import { useAuth, type AuthContextValue } from '../src/core/auth/AuthContext';
import { NotificationCenterScreen } from '../src/features/notifications/NotificationCenterScreen';
import { SearchScreen } from '../src/features/notifications/SearchScreen';

jest.mock('../src/core/auth/AuthContext', () => ({ useAuth: jest.fn() }));
const mockedUseAuth = jest.mocked(useAuth);

function context(request: jest.Mock): AuthContextValue {
  return {
    status: 'authenticated',
    authNotice: null,
    user: {
      id: 'u1',
      email: 'learner@example.test',
      role: 'LEARNER',
      isActive: true,
      mustChangePassword: false,
      profile: { firstName: 'Leila' },
      createdAt: '',
      updatedAt: '',
    },
    request,
    download: jest.fn(),
    dismissAuthNotice: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    updateProfile: jest.fn(),
  };
}

describe('latest Web parity surfaces', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps backend-owned Web links to native destinations', () => {
    expect(destinationForBackendLink('/app/content/training-1')).toEqual({
      name: 'Content',
      params: { trainingId: 'training-1' },
    });
    expect(destinationForBackendLink('/app/evaluations/evaluation-1')).toEqual({
      name: 'Evaluations',
      params: { evaluationId: 'evaluation-1' },
    });
    expect(destinationForBackendLink('/app/payments')).toEqual({
      name: 'Purchases',
    });
  });

  it('debounces role-aware search and opens a native result', async () => {
    const request = jest.fn().mockResolvedValue({
      query: 'sécurité',
      groups: [
        {
          type: 'TRAINING',
          items: [
            {
              id: 'training-1',
              type: 'TRAINING',
              title: 'Sécurité au travail',
              link: '/trainings/training-1',
            },
          ],
        },
      ],
    });
    const navigate = jest.fn();
    mockedUseAuth.mockReturnValue(context(request));
    const screen = await render(
      <SearchScreen
        navigation={{ navigate } as never}
        route={{ key: 'search', name: 'Search' } as never}
      />,
    );
    await fireEvent.changeText(
      screen.getByLabelText('Recherche'),
      'sécurité',
    );
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        '/search?q=s%C3%A9curit%C3%A9&limit=8',
      ),
    );
    await fireEvent.press(await screen.findByText('Sécurité au travail'));
    expect(navigate).toHaveBeenCalledWith('TrainingDetail', {
      trainingId: 'training-1',
    });
  }, 15_000);

  it('loads unread notifications and persists read state through the API', async () => {
    const request = jest.fn((path: string) => {
      if (path.includes('/notifications?page='))
        return Promise.resolve({
          items: [
            {
              id: 'n1',
              type: 'SESSION_REMINDER',
              title: 'Session demain',
              message: 'Votre session commence à 09:00.',
              timestamp: '2026-09-18T08:00:00.000Z',
              read: false,
              link: '/app/attendance',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          unread: 1,
        });
      return Promise.resolve({});
    });
    const navigate = jest.fn();
    mockedUseAuth.mockReturnValue(context(request));
    const screen = await render(
      <NotificationCenterScreen
        navigation={{ navigate } as never}
        route={{ key: 'notifications', name: 'Notifications' } as never}
      />,
    );
    await fireEvent.press(await screen.findByText('Session demain'));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith('/notifications/n1/read', {
        method: 'PATCH',
      }),
    );
    expect(navigate).toHaveBeenCalledWith('Attendance', undefined);
  });
});

import { ApiClient } from '../src/core/api/client';
import { refreshMobileSession } from '../src/core/auth/mobile-session';
import type { MobileAuthSession } from '../src/core/auth/types';
import type { RefreshTokenStore } from '../src/core/storage/refresh-token-store';

const session: MobileAuthSession = {
  accessToken: 'access-token',
  refreshToken: 'rotated-refresh-token',
  user: {
    id: 'user-id',
    email: 'learner@example.test',
    role: 'LEARNER',
    isActive: true,
    mustChangePassword: false,
    profile: { firstName: 'Amira', lastName: 'Ben Ali' },
    createdAt: '2026-08-23T00:00:00.000Z',
    updatedAt: '2026-08-23T00:00:00.000Z',
  },
};

describe('Mobile secure session refresh', () => {
  it('sends the stored token and persists the rotated token', async () => {
    const request = jest
      .spyOn(ApiClient.prototype, 'request')
      .mockResolvedValue(session);
    const store: RefreshTokenStore = {
      get: jest.fn(async () => 'current-refresh-token'),
      set: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    };

    await expect(
      refreshMobileSession(
        new ApiClient('https://api.example.test/api'),
        store,
      ),
    ).resolves.toEqual(session);
    expect(request).toHaveBeenCalledWith('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({
        client: 'MOBILE',
        refreshToken: 'current-refresh-token',
      }),
    });
    expect(store.set).toHaveBeenCalledWith('rotated-refresh-token');
    request.mockRestore();
  });

  it('does not contact the API when secure storage is empty', async () => {
    const request = jest.spyOn(ApiClient.prototype, 'request');
    const store: RefreshTokenStore = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => undefined),
      clear: jest.fn(async () => undefined),
    };

    await expect(
      refreshMobileSession(
        new ApiClient('https://api.example.test/api'),
        store,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN', status: 401 });
    expect(request).not.toHaveBeenCalled();
    request.mockRestore();
  });
});

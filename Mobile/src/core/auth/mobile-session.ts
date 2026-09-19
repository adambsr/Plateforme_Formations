import { ApiError, type ApiClient } from '../api/client';
import type { RefreshTokenStore } from '../storage/refresh-token-store';
import type { MobileAuthSession } from './types';

export class SessionRefreshSupersededError extends Error {
  constructor() {
    super('A newer authentication action superseded this session refresh.');
    this.name = 'SessionRefreshSupersededError';
  }
}

export async function refreshMobileSession(
  client: ApiClient,
  store: RefreshTokenStore,
  isCurrent: () => boolean = () => true,
): Promise<MobileAuthSession> {
  const refreshToken = await store.get();
  if (refreshToken === null) {
    throw new ApiError(
      401,
      'INVALID_REFRESH_TOKEN',
      'The refresh token is required.',
    );
  }
  const session = await client.request<MobileAuthSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ client: 'MOBILE', refreshToken }),
  });
  if (!isCurrent()) throw new SessionRefreshSupersededError();
  await store.set(session.refreshToken);
  return session;
}

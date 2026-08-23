import { ApiError, type ApiClient } from '../api/client';
import type { RefreshTokenStore } from '../storage/refresh-token-store';
import type { MobileAuthSession } from './types';

export async function refreshMobileSession(
  client: ApiClient,
  store: RefreshTokenStore,
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
  await store.set(session.refreshToken);
  return session;
}

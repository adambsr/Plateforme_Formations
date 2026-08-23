import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'plateforme-formations.refresh-token';

export interface RefreshTokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export const secureRefreshTokenStore: RefreshTokenStore = {
  get: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  set: (token) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};

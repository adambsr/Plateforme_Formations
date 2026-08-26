export interface MobileAppConfig {
  apiBaseUrl: string;
  centerName: string;
  appScheme: string;
}

interface MobileEnvironment {
  apiBaseUrl?: string;
  centerName?: string;
  appScheme?: string;
}

function requiredUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit être une URL valide.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_BASE_URL doit utiliser HTTP ou HTTPS.');
  }
  return normalized;
}

function requiredText(value: string, variable: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${variable} ne peut pas être vide.`);
  }
  return normalized;
}

function requiredScheme(value: string): string {
  const normalized = requiredText(value, 'EXPO_PUBLIC_APP_SCHEME');
  if (!/^[a-z][a-z0-9+.-]*$/i.test(normalized)) {
    throw new Error(
      'EXPO_PUBLIC_APP_SCHEME doit être un schéma URI valide sans ://.',
    );
  }
  return normalized;
}

export function createMobileAppConfig(
  environment: MobileEnvironment,
): MobileAppConfig {
  return {
    apiBaseUrl: requiredUrl(
      environment.apiBaseUrl ?? 'http://10.0.2.2:3000/api',
    ),
    centerName: requiredText(
      environment.centerName ?? 'High Skills Academy',
      'EXPO_PUBLIC_CENTER_NAME',
    ),
    appScheme: requiredScheme(environment.appScheme ?? 'plateforme-formations'),
  };
}

export const appConfig = createMobileAppConfig({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  centerName: process.env.EXPO_PUBLIC_CENTER_NAME,
  appScheme: process.env.EXPO_PUBLIC_APP_SCHEME,
});

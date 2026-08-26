import { createMobileAppConfig } from '../src/core/config/environment';

describe('Mobile environment configuration', () => {
  it('normalizes public configuration', () => {
    expect(
      createMobileAppConfig({
        apiBaseUrl: 'https://api.example.test/api/',
        centerName: ' High Skills Academy ',
        appScheme: 'plateforme-formations',
      }),
    ).toEqual({
      apiBaseUrl: 'https://api.example.test/api',
      centerName: 'High Skills Academy',
      appScheme: 'plateforme-formations',
    });
  });

  it('rejects a non-http API URL', () => {
    expect(() => createMobileAppConfig({ apiBaseUrl: 'file:///api' })).toThrow(
      'HTTP ou HTTPS',
    );
  });

  it('rejects an unsafe deep-link scheme', () => {
    expect(() =>
      createMobileAppConfig({ appScheme: 'https://example.test' }),
    ).toThrow('schéma URI valide');
  });
});

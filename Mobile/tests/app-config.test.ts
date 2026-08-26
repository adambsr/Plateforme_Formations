import appConfig from '../app.json';

describe('Expo application configuration', () => {
  it('uses the project identity', () => {
    expect(appConfig.expo.name).toBe('High Skills Academy');
    expect(appConfig.expo.slug).toBe('plateforme-formations');
    expect(appConfig.expo.scheme).toBe('plateforme-formations');
    expect(appConfig.expo.plugins).toContain('expo-secure-store');
  });
});

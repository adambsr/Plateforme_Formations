import appConfig from '../app.json';

describe('Expo application configuration', () => {
  it('uses the project identity', () => {
    expect(appConfig.expo.name).toBe('High Skills Academy');
    expect(appConfig.expo.slug).toBe('plateforme-formations');
    expect(appConfig.expo.scheme).toBe('plateforme-formations');
    expect(appConfig.expo.plugins).toContain('expo-secure-store');
    expect(appConfig.expo.icon).toBe('./assets/hsa-app-icon.png');
    expect(appConfig.expo.splash?.image).toBe('./assets/hsa-app-icon.png');
    expect(appConfig.expo.android.adaptiveIcon.backgroundImage).toBeUndefined();
    expect(appConfig.expo.android.adaptiveIcon.foregroundImage).toBe(
      './assets/android-icon-foreground.png',
    );
    expect(appConfig.expo.android.adaptiveIcon.monochromeImage).toBe(
      './assets/android-icon-monochrome.png',
    );
  });
});

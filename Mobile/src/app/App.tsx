import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../core/auth/AuthProvider';
import { AnalyticsConsentBanner } from '../core/analytics/AnalyticsConsentBanner';
import { trackScreenView } from '../core/analytics/firebase';
import { navigationTheme } from '../shared/theme/navigation';
import { ThemeProvider, useAppTheme } from '../shared/theme/ThemeProvider';
import { RootNavigator } from './navigation/RootNavigator';
import { linking } from './navigation/linking';
import { navigationRef } from './navigation/navigation-ref';
import { openPendingNotification } from './navigation/notification-navigation';
import { NotificationProvider } from '../core/notifications/NotificationProvider';
import { PublicConcierge } from '../features/public/PublicConcierge';
import { MobileErrorBoundary } from '../features/system/SystemScreens';

export function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp() {
  const { theme } = useAppTheme();
  return (
    <AuthProvider>
      <NavigationContainer
        linking={linking}
        ref={navigationRef}
        theme={navigationTheme(theme === 'dark')}
        onReady={() => {
          const route = navigationRef.getCurrentRoute();
          if (route !== undefined) trackScreenView(route.name);
          openPendingNotification();
        }}
        onStateChange={() => {
          const route = navigationRef.getCurrentRoute();
          if (route !== undefined) trackScreenView(route.name);
        }}
      >
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <MobileErrorBoundary>
          <NotificationProvider>
            <RootNavigator />
            <PublicConcierge key={`concierge-${theme}`} />
            <AnalyticsConsentBanner key={`analytics-${theme}`} />
          </NotificationProvider>
        </MobileErrorBoundary>
      </NavigationContainer>
    </AuthProvider>
  );
}

import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '../core/auth/AuthProvider';
import { AnalyticsConsentBanner } from '../core/analytics/AnalyticsConsentBanner';
import { trackScreenView } from '../core/analytics/firebase';
import { navigationTheme } from '../shared/theme/navigation';
import { RootNavigator } from './navigation/RootNavigator';
import { linking } from './navigation/linking';
import { navigationRef } from './navigation/navigation-ref';
import { openPendingNotification } from './navigation/notification-navigation';
import { NotificationProvider } from '../core/notifications/NotificationProvider';
import { PublicConcierge } from '../features/public/PublicConcierge';

export function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer
          linking={linking}
          ref={navigationRef}
          theme={navigationTheme}
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
          <StatusBar style="dark" />
          <NotificationProvider>
            <RootNavigator />
            <PublicConcierge />
            <AnalyticsConsentBanner />
          </NotificationProvider>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

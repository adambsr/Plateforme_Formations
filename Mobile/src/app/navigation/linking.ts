import type { LinkingOptions } from '@react-navigation/native';

import { appConfig } from '../../core/config/environment';

export const linking: LinkingOptions<Record<string, object | undefined>> = {
  prefixes: [`${appConfig.appScheme}://`],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      CheckoutReturn: 'payments/:result',
    },
  },
};

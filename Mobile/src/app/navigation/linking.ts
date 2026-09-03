import type { LinkingOptions } from '@react-navigation/native';

import { appConfig } from '../../core/config/environment';

export const linking: LinkingOptions<Record<string, object | undefined>> = {
  prefixes: [`${appConfig.appScheme}://`],
  config: {
    screens: {
      Home: '',
      Catalogue: 'catalogue',
      TrainingDetail: 'trainings/:trainingId',
      About: 'about',
      Faq: 'faq',
      Contact: 'contact',
      ResetPassword: 'reset-password',
      CheckoutReturn: 'payments/:result',
    },
  },
};

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
      Legal: 'legal/:kind',
      ResetPassword: 'reset-password',
      CheckoutReturn: 'payments/:result',
      Search: 'app/search',
      Notifications: 'app/notifications',
      Content: 'app/content/:trainingId',
      Evaluations: 'app/evaluations/:evaluationId?',
      NotFound: '*',
    },
  },
};

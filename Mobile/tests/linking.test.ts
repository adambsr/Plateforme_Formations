import { linking } from '../src/app/navigation/linking';

describe('Mobile deep-link contract', () => {
  it('routes password reset and Stripe return links through the app scheme', () => {
    expect(linking.prefixes).toEqual(['plateforme-formations://']);
    expect(linking.config?.screens).toMatchObject({
      ResetPassword: 'reset-password',
      CheckoutReturn: 'payments/:result',
    });
  });
});

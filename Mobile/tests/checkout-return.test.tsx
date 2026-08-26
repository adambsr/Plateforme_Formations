import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';

import type { AppStackParamList } from '../src/app/navigation/types';
import { useAuth, type AuthContextValue } from '../src/core/auth/AuthContext';
import { CheckoutReturnScreen } from '../src/features/payments/PaymentScreens';

jest.mock('../src/core/auth/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = jest.mocked(useAuth);

describe('Stripe Mobile return', () => {
  it('queries backend Payment state instead of trusting the success deep link', async () => {
    const request = jest.fn().mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      training: { id: '507f1f77bcf86cd799439012', title: 'Formation test' },
      purchaseType: 'SELF_PACED_ONLINE',
      status: 'PAID',
      amountMinor: 12500,
      currency: 'EUR',
      enrollmentId: '507f1f77bcf86cd799439013',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      user: {
        id: '507f1f77bcf86cd799439014',
        email: 'learner@example.test',
        role: 'LEARNER',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: 'Test', lastName: 'Learner' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      changePassword: jest.fn(),
      updateProfile: jest.fn(),
      request,
      download: jest.fn(),
    } as AuthContextValue);
    const props = {
      navigation: { navigate: jest.fn() },
      route: {
        key: 'checkout-return',
        name: 'CheckoutReturn',
        params: {
          paymentId: '507f1f77bcf86cd799439011',
          result: 'success',
        },
      },
    } as unknown as NativeStackScreenProps<AppStackParamList, 'CheckoutReturn'>;

    const screen = await render(<CheckoutReturnScreen {...props} />);

    expect(await screen.findByText('Payé')).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/payments/507f1f77bcf86cd799439011');
    expect(
      screen.getByText(
        /Le retour du navigateur ne confirme jamais le paiement/,
      ),
    ).toBeTruthy();
  });
});

import {
  credentialsError,
  passwordChangeError,
  registrationError,
} from '../src/features/auth/validation';

describe('Mobile authentication validation', () => {
  it('accepts valid learner registration data', () => {
    expect(
      registrationError({
        firstName: 'Amira',
        lastName: 'Ben Ali',
        email: 'amira@example.test',
        password: 'password-123',
        confirmPassword: 'password-123',
      }),
    ).toBeNull();
  });

  it('keeps public registration learner-only by accepting no role field', () => {
    expect(credentialsError('amira@example.test', 'password-123')).toBeNull();
  });

  it('rejects mismatched and unchanged passwords', () => {
    expect(
      passwordChangeError('password-123', 'password-123', 'password-123'),
    ).toContain('différent');
    expect(
      passwordChangeError('password-123', 'new-password', 'other-password'),
    ).toContain('correspondre');
  });
});

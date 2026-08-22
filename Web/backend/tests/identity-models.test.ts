import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { PasswordResetTokenModel } from '../src/modules/auth/models/password-reset-token.model.js';
import { RefreshSessionModel } from '../src/modules/auth/models/refresh-session.model.js';
import { UserModel } from '../src/modules/users/models/user.model.js';

function indexOptions(model: typeof UserModel, name: string) {
  return model.schema
    .indexes()
    .find(([, options]) => options.name === name)?.[1];
}

describe('identity model contracts', () => {
  it('normalizes User email and applies secure lifecycle defaults', async () => {
    const user = new UserModel({
      email: '  ADMIN@Example.COM ',
      passwordHash: 'stored-hash',
      role: 'ADMIN',
      passwordChangedAt: new Date(),
    });

    await user.validate();

    expect(user.email).toBe('admin@example.com');
    expect(user.isActive).toBe(true);
    expect(user.mustChangePassword).toBe(false);
    expect(user.profile).toBeDefined();
    expect(UserModel.schema.path('passwordHash').options.select).toBe(false);
  });

  it('declares unique email and single-Admin indexes', () => {
    expect(indexOptions(UserModel, 'unique_user_email')).toMatchObject({
      unique: true,
    });
    expect(indexOptions(UserModel, 'unique_admin_role')).toMatchObject({
      unique: true,
      partialFilterExpression: { role: 'ADMIN' },
    });
  });

  it('stores only token hashes and declares security lookup indexes', async () => {
    const userId = new Types.ObjectId();
    const refresh = new RefreshSessionModel({
      userId,
      tokenHash: 'refresh-hash',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const reset = new PasswordResetTokenModel({
      userId,
      tokenHash: 'reset-hash',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await Promise.all([refresh.validate(), reset.validate()]);

    expect(RefreshSessionModel.schema.path('tokenHash').options.select).toBe(
      false,
    );
    expect(
      PasswordResetTokenModel.schema.path('tokenHash').options.select,
    ).toBe(false);
    expect(RefreshSessionModel.schema.path('token')).toBeUndefined();
    expect(PasswordResetTokenModel.schema.path('token')).toBeUndefined();

    const refreshIndexes = RefreshSessionModel.schema.indexes();
    expect(
      refreshIndexes.some(
        ([, options]) => options.name === 'refresh_session_user',
      ),
    ).toBe(true);
    expect(
      refreshIndexes.some(
        ([, options]) => options.name === 'refresh_session_expiry',
      ),
    ).toBe(true);
    expect(
      refreshIndexes.some(
        ([, options]) => options.name === 'refresh_session_user_revocation',
      ),
    ).toBe(true);

    const ttlIndex = PasswordResetTokenModel.schema
      .indexes()
      .find(([, options]) => options.name === 'password_reset_token_ttl')?.[1];
    expect(ttlIndex).toMatchObject({ expireAfterSeconds: 0 });
  });
});

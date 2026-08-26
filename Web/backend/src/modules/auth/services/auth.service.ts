import mongoose from 'mongoose';

import type { AppConfig } from '../../../config/environment.js';
import type { PasswordResetMailService } from '../../../infrastructure/mail/password-reset-mail.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../../shared/auth/password.js';
import { UserModel, type User } from '../../users/models/user.model.js';
import {
  toPublicUser,
  type PublicUser,
} from '../../users/services/public-user.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterLearnerInput,
  ResetPasswordInput,
} from '../dto/auth.dto.js';
import { PasswordResetTokenModel } from '../models/password-reset-token.model.js';
import { RefreshSessionModel } from '../models/refresh-session.model.js';
import { TokenService } from './token.service.js';

export interface AuthSessionResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: PublicUser;
}

export function passwordResetUrl(
  application: Pick<AppConfig['application'], 'webAppUrl' | 'mobileAppScheme'>,
  rawToken: string,
  client: 'WEB' | 'MOBILE',
): string {
  const baseUrl =
    client === 'MOBILE'
      ? `${application.mobileAppScheme}://reset-password`
      : `${application.webAppUrl}/reset-password`;
  return `${baseUrl}?token=${encodeURIComponent(rawToken)}`;
}

const invalidCredentials = () =>
  new AppError(
    401,
    'INVALID_CREDENTIALS',
    'The email or password is incorrect.',
  );

export class AuthService {
  readonly #config: AppConfig;
  readonly #tokens: TokenService;
  readonly #mail: PasswordResetMailService;

  constructor(
    config: AppConfig,
    tokens: TokenService,
    mail: PasswordResetMailService,
  ) {
    this.#config = config;
    this.#tokens = tokens;
    this.#mail = mail;
  }

  async registerLearner(
    input: RegisterLearnerInput,
  ): Promise<AuthSessionResult> {
    const passwordHash = await hashPassword(input.password);
    let user;
    try {
      user = await UserModel.create({
        email: input.email,
        passwordHash,
        role: 'LEARNER',
        isActive: true,
        mustChangePassword: false,
        profile: { firstName: input.firstName, lastName: input.lastName },
        passwordChangedAt: new Date(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          'EMAIL_ALREADY_EXISTS',
          'An account already uses this email.',
        );
      }
      throw error;
    }
    return this.#createSession(user);
  }

  async login(input: LoginInput): Promise<AuthSessionResult> {
    const user = await UserModel.findOne({ email: input.email })
      .select('+passwordHash')
      .exec();
    if (
      user === null ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      throw invalidCredentials();
    }
    if (!user.isActive) {
      throw new AppError(
        401,
        'ACCOUNT_UNAVAILABLE',
        'The account is unavailable.',
      );
    }
    return this.#createSession(user);
  }

  async refresh(rawToken: string): Promise<AuthSessionResult> {
    const now = new Date();
    const tokenHash = this.#tokens.hashOpaqueToken(rawToken);
    const current = await RefreshSessionModel.findOne({ tokenHash })
      .select('+tokenHash')
      .exec();
    if (current === null) {
      throw new AppError(
        401,
        'INVALID_REFRESH_TOKEN',
        'The refresh token is invalid.',
      );
    }
    if (current.revokedAt !== undefined) {
      await RefreshSessionModel.updateMany(
        { userId: current.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
      );
      throw new AppError(
        401,
        'REFRESH_TOKEN_REUSED',
        'The refresh token has already been used.',
      );
    }
    if (current.expiresAt <= now) {
      current.revokedAt = now;
      await current.save();
      throw new AppError(
        401,
        'REFRESH_TOKEN_EXPIRED',
        'The refresh token has expired.',
      );
    }

    const user = await UserModel.findById(current.userId).exec();
    if (user === null || !user.isActive) {
      await RefreshSessionModel.updateMany(
        { userId: current.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
      );
      throw new AppError(
        401,
        'ACCOUNT_UNAVAILABLE',
        'The account is unavailable.',
      );
    }

    const generated = this.#tokens.createRefreshToken(now);
    const replacement = new RefreshSessionModel({
      userId: user._id,
      tokenHash: generated.tokenHash,
      expiresAt: generated.expiresAt,
    });

    await mongoose.connection.transaction(async (session) => {
      const update = await RefreshSessionModel.updateOne(
        {
          _id: current._id,
          revokedAt: { $exists: false },
          expiresAt: { $gt: now },
        },
        { $set: { revokedAt: now, replacedBySessionId: replacement._id } },
        { session },
      );
      if (update.modifiedCount !== 1) {
        throw new AppError(
          401,
          'REFRESH_TOKEN_REUSED',
          'The refresh token has already been used.',
        );
      }
      await replacement.save({ session });
    });

    return {
      accessToken: await this.#tokens.createAccessToken({
        userId: String(user._id),
        role: user.role,
      }),
      refreshToken: generated.rawToken,
      refreshExpiresAt: generated.expiresAt,
      user: toPublicUser(user),
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken === undefined) return;
    await RefreshSessionModel.updateOne(
      {
        tokenHash: this.#tokens.hashOpaqueToken(rawToken),
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
    );
  }

  async forgotPassword(
    email: string,
    client: 'WEB' | 'MOBILE' = 'WEB',
  ): Promise<void> {
    const user = await UserModel.findOne({ email, isActive: true }).exec();
    if (user === null) return;

    const now = new Date();
    await PasswordResetTokenModel.updateMany(
      { userId: user._id, usedAt: { $exists: false } },
      { $set: { usedAt: now } },
    );
    const generated = this.#tokens.createPasswordResetToken();
    const token = await PasswordResetTokenModel.create({
      userId: user._id,
      tokenHash: generated.tokenHash,
      expiresAt: new Date(
        now.getTime() +
          this.#config.authentication.passwordResetTtlMinutes * 60_000,
      ),
    });

    const resetUrl = passwordResetUrl(
      this.#config.application,
      generated.rawToken,
      client,
    );
    try {
      await this.#mail.sendPasswordReset(user.email, resetUrl);
    } catch (error) {
      await PasswordResetTokenModel.deleteOne({ _id: token._id });
      throw error;
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const now = new Date();
    const tokenHash = this.#tokens.hashOpaqueToken(input.token);
    const resetToken = await PasswordResetTokenModel.findOne({
      tokenHash,
    }).exec();
    if (
      resetToken === null ||
      resetToken.usedAt !== undefined ||
      resetToken.expiresAt <= now
    ) {
      throw new AppError(
        400,
        'INVALID_PASSWORD_RESET_TOKEN',
        'The password reset token is invalid or expired.',
      );
    }
    const passwordHash = await hashPassword(input.newPassword);

    await mongoose.connection.transaction(async (session) => {
      const claimed = await PasswordResetTokenModel.updateOne(
        {
          _id: resetToken._id,
          usedAt: { $exists: false },
          expiresAt: { $gt: now },
        },
        { $set: { usedAt: now } },
        { session },
      );
      if (claimed.modifiedCount !== 1) {
        throw new AppError(
          400,
          'INVALID_PASSWORD_RESET_TOKEN',
          'The password reset token is invalid or expired.',
        );
      }
      const updated = await UserModel.updateOne(
        { _id: resetToken.userId, isActive: true },
        {
          $set: {
            passwordHash,
            passwordChangedAt: now,
            mustChangePassword: false,
          },
        },
        { session },
      );
      if (updated.modifiedCount !== 1) {
        throw new AppError(
          400,
          'INVALID_PASSWORD_RESET_TOKEN',
          'The account is unavailable.',
        );
      }
      await RefreshSessionModel.updateMany(
        { userId: resetToken.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
        { session },
      );
    });
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<AuthSessionResult> {
    const user = await UserModel.findById(userId)
      .select('+passwordHash')
      .exec();
    if (user === null || !user.isActive) {
      throw new AppError(
        401,
        'ACCOUNT_UNAVAILABLE',
        'The account is unavailable.',
      );
    }
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError(
        400,
        'CURRENT_PASSWORD_INCORRECT',
        'The current password is incorrect.',
      );
    }
    const now = new Date();
    const passwordHash = await hashPassword(input.newPassword);
    await mongoose.connection.transaction(async (session) => {
      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash,
            passwordChangedAt: now,
            mustChangePassword: false,
          },
        },
        { session },
      );
      await RefreshSessionModel.updateMany(
        { userId: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
        { session },
      );
    });
    user.passwordHash = passwordHash;
    user.passwordChangedAt = now;
    user.mustChangePassword = false;
    return this.#createSession(user);
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await UserModel.findById(userId).exec();
    if (user === null || !user.isActive) {
      throw new AppError(
        401,
        'ACCOUNT_UNAVAILABLE',
        'The account is unavailable.',
      );
    }
    return toPublicUser(user);
  }

  async #createSession(
    user: mongoose.HydratedDocument<User>,
  ): Promise<AuthSessionResult> {
    const generated = this.#tokens.createRefreshToken();
    await RefreshSessionModel.create({
      userId: user._id,
      tokenHash: generated.tokenHash,
      expiresAt: generated.expiresAt,
    });
    return {
      accessToken: await this.#tokens.createAccessToken({
        userId: String(user._id),
        role: user.role,
      }),
      refreshToken: generated.rawToken,
      refreshExpiresAt: generated.expiresAt,
      user: toPublicUser(user),
    };
  }
}

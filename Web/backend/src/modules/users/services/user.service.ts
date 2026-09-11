import mongoose from 'mongoose';
import type { Logger } from 'pino';

import { deliverBestEffort } from '../../../infrastructure/mail/email-delivery.js';
import type { TransactionalEmailService } from '../../../infrastructure/mail/email-service.js';
import { hashPassword } from '../../../shared/auth/password.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { RefreshSessionModel } from '../../auth/models/refresh-session.model.js';
import { PasswordResetTokenModel } from '../../auth/models/password-reset-token.model.js';
import { NotificationDeviceModel } from '../../notifications/models/notification-device.model.js';
import type {
  CreateTrainerInput,
  UpdateProfileInput,
} from '../dto/user.dto.js';
import type { UserRole } from '../domain/user-role.js';
import { UserModel } from '../models/user.model.js';
import { toPublicUser, type PublicUser } from './public-user.js';

export interface PaginatedUsers {
  items: PublicUser[];
  page: number;
  pageSize: number;
  total: number;
}

export class UserService {
  readonly #mail: TransactionalEmailService;
  readonly #logger: Logger;

  constructor(mail: TransactionalEmailService, logger: Logger) {
    this.#mail = mail;
    this.#logger = logger;
  }

  async createTrainer(input: CreateTrainerInput): Promise<PublicUser> {
    const passwordHash = await hashPassword(input.temporaryPassword);
    try {
      const user = await UserModel.create({
        email: input.email,
        passwordHash,
        role: 'TRAINER',
        isActive: true,
        mustChangePassword: true,
        profile: { firstName: input.firstName, lastName: input.lastName },
        passwordChangedAt: new Date(),
      });
      await deliverBestEffort(this.#logger, 'trainer-welcome', () =>
        this.#mail.sendWelcome({
          email: user.email,
          ...(user.profile.firstName === undefined
            ? {}
            : { firstName: user.profile.firstName }),
          temporaryPassword: true,
        }),
      );
      return toPublicUser(user);
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
  }

  async list(
    role: UserRole | undefined,
    page: number,
    pageSize: number,
  ): Promise<PaginatedUsers> {
    const filter = role === undefined ? {} : { role };
    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      UserModel.countDocuments(filter),
    ]);
    return { items: users.map(toPublicUser), page, pageSize, total };
  }

  async getById(userId: string, requiredRole?: UserRole): Promise<PublicUser> {
    const user = await UserModel.findById(userId).exec();
    if (
      user === null ||
      (requiredRole !== undefined && user.role !== requiredRole)
    ) {
      throw new AppError(404, 'USER_NOT_FOUND', 'The user does not exist.');
    }
    return toPublicUser(user);
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<PublicUser> {
    const user = await UserModel.findOneAndUpdate(
      { _id: userId, isActive: true },
      { $set: { profile: input } },
      { returnDocument: 'after', runValidators: true },
    ).exec();
    if (user === null) {
      throw new AppError(404, 'USER_NOT_FOUND', 'The user does not exist.');
    }
    return toPublicUser(user);
  }

  async disableUser(userId: string, actingUserId: string): Promise<PublicUser> {
    if (userId === actingUserId) {
      throw new AppError(
        409,
        'SELF_ACCOUNT_ACTION_FORBIDDEN',
        'You cannot deactivate your own administrator account.',
      );
    }
    const now = new Date();
    return mongoose.connection.transaction(async (session) => {
      const user = await UserModel.findOneAndUpdate(
        { _id: userId, isActive: true },
        { $set: { isActive: false } },
        { returnDocument: 'after', session },
      ).exec();
      if (user === null) {
        const existing = await UserModel.findById(userId)
          .session(session)
          .exec();
        if (existing === null) {
          throw new AppError(404, 'USER_NOT_FOUND', 'The user does not exist.');
        }
        return toPublicUser(existing);
      }
      await RefreshSessionModel.updateMany(
        { userId: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
        { session },
      );
      return toPublicUser(user);
    });
  }

  async deleteUser(userId: string, actingUserId: string): Promise<void> {
    if (userId === actingUserId) {
      throw new AppError(
        409,
        'SELF_ACCOUNT_ACTION_FORBIDDEN',
        'You cannot delete your own administrator account.',
      );
    }
    await mongoose.connection.transaction(async (session) => {
      const deleted = await UserModel.findByIdAndDelete(userId, { session });
      if (deleted === null) {
        throw new AppError(404, 'USER_NOT_FOUND', 'The user does not exist.');
      }
      await Promise.all([
        RefreshSessionModel.deleteMany({ userId }, { session }),
        PasswordResetTokenModel.deleteMany({ userId }, { session }),
        NotificationDeviceModel.deleteMany({ userId }, { session }),
      ]);
    });
  }
}

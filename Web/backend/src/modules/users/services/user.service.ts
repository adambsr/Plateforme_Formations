import mongoose from 'mongoose';

import { hashPassword } from '../../../shared/auth/password.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { RefreshSessionModel } from '../../auth/models/refresh-session.model.js';
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

  async disableTrainer(userId: string): Promise<PublicUser> {
    const now = new Date();
    return mongoose.connection.transaction(async (session) => {
      const user = await UserModel.findOneAndUpdate(
        { _id: userId, role: 'TRAINER', isActive: true },
        { $set: { isActive: false } },
        { returnDocument: 'after', session },
      ).exec();
      if (user === null) {
        const existing = await UserModel.findOne({
          _id: userId,
          role: 'TRAINER',
        })
          .session(session)
          .exec();
        if (existing === null) {
          throw new AppError(
            404,
            'TRAINER_NOT_FOUND',
            'The Trainer does not exist.',
          );
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
}

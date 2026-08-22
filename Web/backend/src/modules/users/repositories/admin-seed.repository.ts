import { UserModel } from '../models/user.model.js';

export interface SeededUserReference {
  id: string;
  email: string;
}

export interface CreateInitialAdminInput {
  email: string;
  passwordHash: string;
  passwordChangedAt: Date;
}

export interface AdminSeedRepository {
  findAdmin(): Promise<SeededUserReference | null>;
  findByEmail(email: string): Promise<SeededUserReference | null>;
  createAdmin(input: CreateInitialAdminInput): Promise<SeededUserReference>;
}

export const mongooseAdminSeedRepository: AdminSeedRepository = {
  async findAdmin() {
    const user = await UserModel.findOne({ role: 'ADMIN' })
      .select({ email: 1 })
      .exec();
    return user === null ? null : { id: String(user._id), email: user.email };
  },

  async findByEmail(email) {
    const user = await UserModel.findOne({ email }).select({ email: 1 }).exec();
    return user === null ? null : { id: String(user._id), email: user.email };
  },

  async createAdmin(input) {
    const user = await UserModel.create({
      email: input.email,
      passwordHash: input.passwordHash,
      role: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
      profile: {},
      passwordChangedAt: input.passwordChangedAt,
    });
    return { id: String(user._id), email: user.email };
  },
};

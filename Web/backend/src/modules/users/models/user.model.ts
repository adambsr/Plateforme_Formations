import mongoose, { type Model } from 'mongoose';

import { USER_ROLES, type UserRole } from '../domain/user-role.js';

export interface CommonUserProfile {
  firstName?: string;
  lastName?: string;
}

export interface User {
  email: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  profile: CommonUserProfile;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const commonProfileSchema = new mongoose.Schema<CommonUserProfile>(
  {
    firstName: { type: String, trim: true, minlength: 1, maxlength: 100 },
    lastName: { type: String, trim: true, minlength: 1, maxlength: 100 },
  },
  { _id: false, strict: 'throw' },
);

const userSchema = new mongoose.Schema<User>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 320,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: USER_ROLES },
    isActive: { type: Boolean, required: true, default: true },
    mustChangePassword: { type: Boolean, required: true, default: false },
    profile: { type: commonProfileSchema, required: true, default: () => ({}) },
    passwordChangedAt: { type: Date, required: true },
  },
  {
    collection: 'users',
    strict: 'throw',
    timestamps: true,
  },
);

userSchema.index({ email: 1 }, { unique: true, name: 'unique_user_email' });
userSchema.index(
  { role: 1 },
  {
    unique: true,
    name: 'unique_admin_role',
    partialFilterExpression: { role: 'ADMIN' },
  },
);

export const UserModel =
  (mongoose.models.User as Model<User> | undefined) ??
  mongoose.model<User>('User', userSchema);

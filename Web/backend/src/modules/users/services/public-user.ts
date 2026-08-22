import type { HydratedDocument } from 'mongoose';

import type { User } from '../models/user.model.js';

export interface PublicUser {
  id: string;
  email: string;
  role: User['role'];
  isActive: boolean;
  mustChangePassword: boolean;
  profile: {
    firstName: string | undefined;
    lastName: string | undefined;
  };
  createdAt: string;
  updatedAt: string;
}

export function toPublicUser(user: HydratedDocument<User>): PublicUser {
  return {
    id: String(user._id),
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    profile: {
      firstName: user.profile.firstName,
      lastName: user.profile.lastName,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

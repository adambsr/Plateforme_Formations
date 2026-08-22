import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);
const profileFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
};

export const registerLearnerSchema = z
  .object({
    email,
    password,
    ...profileFields,
    client: z.enum(['WEB', 'MOBILE']).default('WEB'),
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
    client: z.enum(['WEB', 'MOBILE']).default('WEB'),
  })
  .strict();

export const refreshSchema = z
  .object({
    client: z.enum(['WEB', 'MOBILE']).default('WEB'),
    refreshToken: z.string().min(20).optional(),
  })
  .strict();

export const logoutSchema = refreshSchema;

export const forgotPasswordSchema = z.object({ email }).strict();

export const resetPasswordSchema = z
  .object({ token: z.string().min(20), newPassword: password })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    client: z.enum(['WEB', 'MOBILE']).default('WEB'),
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ['newPassword'],
    message: 'The new password must differ from the current password.',
  });

export type RegisterLearnerInput = z.infer<typeof registerLearnerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

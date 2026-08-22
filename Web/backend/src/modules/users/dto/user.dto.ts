import { z } from 'zod';

const email = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const profileFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
};

export const createTrainerSchema = z
  .object({
    email,
    temporaryPassword: z.string().min(8).max(128),
    ...profileFields,
  })
  .strict();

export const updateProfileSchema = z.object(profileFields).strict();

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

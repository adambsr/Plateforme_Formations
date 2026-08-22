import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const progressListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  trainingId: objectIdSchema.optional(),
});

export const updateLessonProgressSchema = z
  .object({ completed: z.boolean() })
  .strict();

export type ProgressListInput = z.infer<typeof progressListSchema>;
export type UpdateLessonProgressInput = z.infer<
  typeof updateLessonProgressSchema
>;

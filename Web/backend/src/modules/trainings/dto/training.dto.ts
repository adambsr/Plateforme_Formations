import { z } from 'zod';

import { TRAINING_TYPES } from '../domain/training.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const shortText = z.string().trim().min(1).max(500);
const optionalDescription = z.string().trim().min(1).max(1_000).optional();
const trainingFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5_000),
  categoryId: objectId,
  level: z.string().trim().min(1).max(100),
  durationMinutes: z.number().int().positive().max(52_560_000),
  objectives: z.array(shortText).max(30).default([]),
  prerequisites: z.array(shortText).max(30).default([]),
  priceMinor: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  minimumAttendancePercent: z.number().int().min(1).max(100).optional(),
};

export const categoryListSchema = z.object({
  includeArchived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(false),
});

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: optionalDescription,
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: optionalDescription.nullable(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const trainingListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: objectId.optional(),
  type: z.enum(TRAINING_TYPES).optional(),
  view: z.enum(['PUBLIC', 'MANAGED']).default('PUBLIC'),
});

export const createTrainingSchema = z
  .object({
    ...trainingFields,
    type: z.enum(TRAINING_TYPES),
    ownerTrainerId: objectId.optional(),
  })
  .strict();

export const updateTrainingSchema = z
  .object({
    title: trainingFields.title.optional(),
    description: trainingFields.description.optional(),
    categoryId: trainingFields.categoryId.optional(),
    level: trainingFields.level.optional(),
    durationMinutes: trainingFields.durationMinutes.optional(),
    objectives: z.array(shortText).max(30).optional(),
    prerequisites: z.array(shortText).max(30).optional(),
    priceMinor: trainingFields.priceMinor.optional(),
    minimumAttendancePercent:
      trainingFields.minimumAttendancePercent.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const transferTrainingOwnerSchema = z
  .object({ ownerTrainerId: objectId })
  .strict();

export const trainingIdSchema = objectId;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type TrainingListInput = z.infer<typeof trainingListSchema>;
export type CreateTrainingInput = z.infer<typeof createTrainingSchema>;
export type UpdateTrainingInput = z.infer<typeof updateTrainingSchema>;

import { z } from 'zod';

import { RESOURCE_TYPES } from '../domain/content.js';

export const contentIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

const order = z.coerce.number().int().positive().max(1_000_000);
const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).default('');
const optionalUpdateText = (maximum: number) =>
  z.string().trim().max(maximum).optional();
const formBoolean = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const createModuleSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText(2_000),
    order,
  })
  .strict();

export const updateModuleSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalUpdateText(2_000),
    order: order.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const createLessonSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText(2_000),
    textContent: z.string().max(100_000).default(''),
    instructions: z.string().max(10_000).default(''),
    order,
  })
  .strict();

export const updateLessonSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalUpdateText(2_000),
    textContent: z.string().max(100_000).optional(),
    instructions: z.string().max(10_000).optional(),
    order: order.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

const externalUrl = z
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'Only HTTP and HTTPS URLs are allowed.',
  });

export const createResourceSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: optionalText(2_000),
    order,
    type: z.enum(RESOURCE_TYPES),
    isVisibleToLearners: formBoolean.default(true),
    externalUrl: externalUrl.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'EXTERNAL_URL' && value.externalUrl === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['externalUrl'],
        message: 'An external URL is required.',
      });
    }
    if (value.type === 'FILE' && value.externalUrl !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['externalUrl'],
        message: 'A file Resource cannot contain an external URL.',
      });
    }
  });

export const updateResourceSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: optionalUpdateText(2_000),
    order: order.optional(),
    isVisibleToLearners: z.boolean().optional(),
    externalUrl: externalUrl.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

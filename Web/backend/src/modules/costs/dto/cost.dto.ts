import { z } from 'zod';

import { entityIdSchema } from '../../certificates/dto/certificate.dto.js';
import { isCalendarDate } from '../../../shared/time/tunis-date-range.js';

const year = z.coerce.number().int().min(2000).max(2100);
const month = z.coerce.number().int().min(1).max(12);
const amountMinor = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const calendarDateSchema = z
  .string()
  .refine(isCalendarDate, 'Date must be a valid YYYY-MM-DD calendar date.');
const page = {
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const trainerCostPathSchema = z.object({
  trainerId: entityIdSchema,
  year,
  month,
});
export const trainerCostWriteSchema = z
  .object({
    amountMinor,
    note: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();
export const trainerCostListSchema = z
  .object({
    ...page,
    trainerId: entityIdSchema.optional(),
    year: year.optional(),
    month: month.optional(),
  })
  .strict();

const trainingCostFields = {
  trainingId: entityIdSchema,
  sessionId: entityIdSchema.optional(),
  date: calendarDateSchema,
  amountMinor,
  label: z.string().trim().min(1).max(200),
};
export const createTrainingCostSchema = z.object(trainingCostFields).strict();
export const updateTrainingCostSchema = z
  .object({
    trainingId: trainingCostFields.trainingId.optional(),
    sessionId: entityIdSchema.nullable().optional(),
    date: trainingCostFields.date.optional(),
    amountMinor: trainingCostFields.amountMinor.optional(),
    label: trainingCostFields.label.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one field is required.',
  );
export const trainingCostListSchema = z
  .object({
    ...page,
    trainingId: entityIdSchema.optional(),
    sessionId: entityIdSchema.optional(),
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.from === undefined) !== (value.to === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: 'from and to must be supplied together.',
      });
    }
    if (
      value.from !== undefined &&
      value.to !== undefined &&
      value.from > value.to
    ) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'to must be on or after from.',
      });
    }
  });

export type TrainerCostPath = z.infer<typeof trainerCostPathSchema>;
export type TrainerCostWrite = z.infer<typeof trainerCostWriteSchema>;
export type TrainerCostList = z.infer<typeof trainerCostListSchema>;
export type CreateTrainingCost = z.infer<typeof createTrainingCostSchema>;
export type UpdateTrainingCost = z.infer<typeof updateTrainingCostSchema>;
export type TrainingCostList = z.infer<typeof trainingCostListSchema>;

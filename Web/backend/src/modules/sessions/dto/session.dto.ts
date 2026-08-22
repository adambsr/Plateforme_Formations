import { z } from 'zod';

import { SESSION_STATUSES } from '../domain/session.js';

export const sessionIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

const optionalFormText = (maximum: number) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.string().trim().min(1).max(maximum).optional(),
  );
const explicitInstant = z
  .string()
  .refine((value) => /(?:Z|[+-]\d{2}:\d{2})$/.test(value), {
    message: 'Timestamp must include an explicit offset or Z.',
  })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Timestamp is invalid.',
  });
const trainerIds = z.array(sessionIdSchema).min(1).max(50);

export const sessionListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  trainingId: sessionIdSchema.optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  view: z.enum(['PUBLIC', 'MANAGED', 'ENROLLED']).default('PUBLIC'),
});

export const createSessionSchema = z
  .object({
    trainingId: sessionIdSchema,
    title: z.string().trim().min(1).max(200),
    identifier: optionalFormText(100),
    capacity: z.number().int().positive().max(100_000),
    assignedTrainerIds: trainerIds.optional(),
    location: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).default(''),
    room: optionalFormText(100),
    additionalInformation: z.string().trim().max(2_000).default(''),
  })
  .strict();

export const updateSessionSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    identifier: optionalFormText(100).nullable(),
    capacity: z.number().int().positive().max(100_000).optional(),
    location: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().max(500).optional(),
    room: optionalFormText(100).nullable(),
    additionalInformation: z.string().trim().max(2_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export const assignSessionTrainersSchema = z
  .object({ assignedTrainerIds: trainerIds })
  .strict();

const scheduleFields = {
  startAt: explicitInstant,
  endAt: explicitInstant,
  moduleId: sessionIdSchema.optional(),
  lessonId: sessionIdSchema.optional(),
  trainerIds,
  location: optionalFormText(200),
  address: optionalFormText(500),
  room: optionalFormText(100),
};

export const createScheduleSchema = z
  .object(scheduleFields)
  .strict()
  .refine((value) => Date.parse(value.startAt) < Date.parse(value.endAt), {
    path: ['endAt'],
    message: 'endAt must be strictly after startAt.',
  });

export const updateScheduleSchema = z
  .object({
    startAt: scheduleFields.startAt.optional(),
    endAt: scheduleFields.endAt.optional(),
    moduleId: scheduleFields.moduleId.nullable(),
    lessonId: scheduleFields.lessonId.nullable(),
    trainerIds: scheduleFields.trainerIds.optional(),
    location: scheduleFields.location.nullable(),
    address: scheduleFields.address.nullable(),
    room: scheduleFields.room.nullable(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required.',
  });

export type SessionListInput = z.infer<typeof sessionListSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

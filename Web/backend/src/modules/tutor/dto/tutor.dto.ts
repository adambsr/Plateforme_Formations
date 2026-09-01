import { z } from 'zod';

const entityId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const TUTOR_MODES = [
  'QUESTION',
  'SIMPLIFY',
  'EXAMPLE',
  'PRACTICE',
  'SUMMARY',
  'REVISION',
] as const;

export const tutorMessageSchema = z
  .object({
    message: z.string().trim().min(2).max(2_000),
    mode: z.enum(TUTOR_MODES).default('QUESTION'),
    currentLessonId: entityId.optional(),
    conversation: z
      .array(
        z
          .object({
            role: z.enum(['USER', 'ASSISTANT']),
            content: z.string().trim().min(1).max(2_000),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict();

export type TutorMessageInput = z.infer<typeof tutorMessageSchema>;

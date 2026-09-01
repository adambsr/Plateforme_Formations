import { z } from 'zod';

const publicPath = z
  .string()
  .trim()
  .max(200)
  .regex(
    /^\/(?:catalogue|about|faq|contact|login|register|trainings\/[a-f\d]{24})?$/i,
    'Only a public website path is allowed.',
  );

export const publicConciergeMessageSchema = z
  .object({
    message: z.string().trim().min(2).max(1_000),
    currentPath: publicPath.default('/'),
    conversation: z
      .array(
        z
          .object({
            role: z.enum(['USER', 'ASSISTANT']),
            content: z.string().trim().min(1).max(1_000),
          })
          .strict(),
      )
      .max(4)
      .default([]),
    // A bot should fill this hidden field; a person should never see it.
    website: z.string().max(200).optional(),
  })
  .strict();

export type PublicConciergeMessageInput = z.infer<
  typeof publicConciergeMessageSchema
>;

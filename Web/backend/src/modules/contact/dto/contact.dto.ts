import { z } from 'zod';

export const contactMessageSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(320),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(10).max(10_000),
  })
  .strict();

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

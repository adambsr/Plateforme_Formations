import { z } from 'zod';

function containsHeaderControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function stripUnsafeBodyControls(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || code > 31;
    })
    .filter((character) => character.charCodeAt(0) !== 127)
    .join('');
}

export const contactMessageSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .refine((value) => !containsHeaderControl(value), 'Invalid name.'),
    email: z.email().max(320),
    subject: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .refine((value) => !containsHeaderControl(value), 'Invalid subject.'),
    message: z
      .string()
      .trim()
      .min(10)
      .max(10_000)
      .transform(stripUnsafeBodyControls),
  })
  .strict();

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

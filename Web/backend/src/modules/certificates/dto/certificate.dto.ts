import { z } from 'zod';

export const entityIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const certificateListSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const generateCertificateSchema = z
  .object({ enrollmentId: entityIdSchema })
  .strict();

export type CertificateListInput = z.infer<typeof certificateListSchema>;
export type GenerateCertificateInput = z.infer<
  typeof generateCertificateSchema
>;

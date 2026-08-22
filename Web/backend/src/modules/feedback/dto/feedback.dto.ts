import { z } from 'zod';

import { entityIdSchema } from '../../certificates/dto/certificate.dto.js';

export const createFeedbackSchema = z
  .object({
    enrollmentId: entityIdSchema,
    rating: z.number().int().min(1).max(5),
  })
  .strict();

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

import { z } from 'zod';

import { calendarDateSchema } from '../../costs/dto/cost.dto.js';

export const dashboardRangeSchema = z
  .object({
    from: calendarDateSchema,
    to: calendarDateSchema,
  })
  .strict()
  .refine((value) => value.from <= value.to, {
    path: ['to'],
    message: 'to must be on or after from.',
  });

export type DashboardRangeInput = z.infer<typeof dashboardRangeSchema>;

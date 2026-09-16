import { z } from 'zod';

export const dashboardSearchSchema = z
  .object({
    q: z.string().trim().min(2).max(80),
    limit: z.coerce.number().int().min(1).max(10).default(5),
  })
  .strict();

export type DashboardSearchInput = z.infer<typeof dashboardSearchSchema>;

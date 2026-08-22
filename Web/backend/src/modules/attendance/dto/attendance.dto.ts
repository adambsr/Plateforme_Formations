import { z } from 'zod';

import { ATTENDANCE_STATUSES } from '../domain/attendance.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const bulkAttendanceSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            enrollmentId: objectId,
            status: z.enum(ATTENDANCE_STATUSES),
          })
          .strict(),
      )
      .min(1)
      .max(1_000),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.entries.forEach((entry, index) => {
      if (seen.has(entry.enrollmentId)) {
        context.addIssue({
          code: 'custom',
          path: ['entries', index, 'enrollmentId'],
          message: 'An Enrollment can appear only once in a bulk update.',
        });
      }
      seen.add(entry.enrollmentId);
    });
  });

export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;

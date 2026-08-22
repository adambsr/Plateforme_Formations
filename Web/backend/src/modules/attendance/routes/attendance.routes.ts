import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import { sessionIdSchema } from '../../sessions/dto/session.dto.js';
import { bulkAttendanceSchema } from '../dto/attendance.dto.js';
import type { AttendanceService } from '../services/attendance.service.js';

export function createAttendanceRouter(
  attendanceService: AttendanceService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const authenticated = [
    authenticate(tokenService),
    requirePasswordChanged,
  ] as const;

  router.get(
    '/sessions/:id/attendance',
    ...authenticated,
    async (request, response) => {
      response.json(
        await attendanceService.sessionAttendance(
          authenticatedPrincipal(request),
          sessionIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.put(
    '/schedules/:id/attendance',
    ...authenticated,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response.json(
        await attendanceService.recordSchedule(
          authenticatedPrincipal(request),
          sessionIdSchema.parse(request.params.id),
          bulkAttendanceSchema.parse(request.body),
        ),
      );
    },
  );

  return router;
}

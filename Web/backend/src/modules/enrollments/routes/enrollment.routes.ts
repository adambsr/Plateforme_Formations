import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  enrollmentListSchema,
  paymentIdSchema,
} from '../../payments/dto/payment.dto.js';
import type { EnrollmentService } from '../services/enrollment.service.js';

export function createEnrollmentRouter(
  enrollmentService: EnrollmentService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const ready = [authenticate(tokenService), requirePasswordChanged] as const;
  router.get('/enrollments', ...ready, async (request, response) => {
    response.json(
      await enrollmentService.list(
        authenticatedPrincipal(request),
        enrollmentListSchema.parse(request.query),
      ),
    );
  });
  router.get('/enrollments/:id', ...ready, async (request, response) => {
    response.json(
      await enrollmentService.get(
        authenticatedPrincipal(request),
        paymentIdSchema.parse(request.params.id),
      ),
    );
  });
  return router;
}

import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import { createFeedbackSchema } from '../dto/feedback.dto.js';
import type { FeedbackService } from '../services/feedback.service.js';

export function createFeedbackRouter(
  service: FeedbackService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const ready = [authenticate(tokenService), requirePasswordChanged] as const;

  router.post('/feedback', ...ready, async (request, response) => {
    response
      .status(201)
      .json(
        await service.create(
          authenticatedPrincipal(request),
          createFeedbackSchema.parse(request.body),
        ),
      );
  });
  router.get('/feedback', ...ready, async (request, response) => {
    response.json(await service.statistics(authenticatedPrincipal(request)));
  });
  return router;
}

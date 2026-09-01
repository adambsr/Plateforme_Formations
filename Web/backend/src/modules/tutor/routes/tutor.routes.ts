import { Router } from 'express';
import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import { rateLimit } from '../../../middleware/rate-limit.js';
import type { TokenService } from '../../auth/services/token.service.js';
import { contentIdSchema } from '../../content/dto/content.dto.js';
import { tutorMessageSchema } from '../dto/tutor.dto.js';
import type { AiTutorService } from '../services/ai-tutor.service.js';

export function createTutorRouter(
  service: AiTutorService,
  tokenService: TokenService,
): Router {
  const router = Router();
  router.post(
    '/trainings/:id/tutor/messages',
    authenticate(tokenService),
    requirePasswordChanged,
    requireRoles('LEARNER'),
    rateLimit('course-tutor', 30),
    async (request, response) => {
      response.json(
        await service.answer(
          authenticatedPrincipal(request),
          contentIdSchema.parse(request.params.id),
          tutorMessageSchema.parse(request.body),
        ),
      );
    },
  );
  return router;
}

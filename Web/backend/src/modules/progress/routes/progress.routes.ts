import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  objectIdSchema,
  progressListSchema,
  updateLessonProgressSchema,
} from '../dto/progress.dto.js';
import type { ProgressService } from '../services/progress.service.js';

export function createProgressRouter(
  progressService: ProgressService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const learner = [
    authenticate(tokenService),
    requirePasswordChanged,
    requireRoles('LEARNER'),
  ] as const;

  router.get('/progress', ...learner, async (request, response) => {
    response.json(
      await progressService.list(
        authenticatedPrincipal(request),
        progressListSchema.parse(request.query),
      ),
    );
  });

  router.put(
    '/progress/lessons/:lessonId',
    ...learner,
    async (request, response) => {
      response.json(
        await progressService.updateLesson(
          authenticatedPrincipal(request),
          objectIdSchema.parse(request.params.lessonId),
          updateLessonProgressSchema.parse(request.body),
        ),
      );
    },
  );

  return router;
}

import { Router } from 'express';

import {
  authenticate,
  authenticateIfPresent,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  assignSessionTrainersSchema,
  createScheduleSchema,
  createSessionSchema,
  sessionIdSchema,
  sessionListSchema,
  updateScheduleSchema,
  updateSessionSchema,
} from '../dto/session.dto.js';
import type { SessionService } from '../services/session.service.js';

export function createSessionRouter(
  sessionService: SessionService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const optionalAuthentication = authenticateIfPresent(tokenService);
  const requiredAuthentication = authenticate(tokenService);
  const privileged = [
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
  ] as const;

  router.get('/sessions', optionalAuthentication, async (request, response) => {
    response.json(
      await sessionService.listSessions(
        sessionListSchema.parse(request.query),
        request.principal,
      ),
    );
  });

  router.get('/session-trainers', ...privileged, async (request, response) => {
    response.json(
      await sessionService.listAssignableTrainers(
        authenticatedPrincipal(request),
      ),
    );
  });

  router.post('/sessions', ...privileged, async (request, response) => {
    response
      .status(201)
      .json(
        await sessionService.createSession(
          authenticatedPrincipal(request),
          createSessionSchema.parse(request.body),
        ),
      );
  });

  router.get(
    '/sessions/:id',
    optionalAuthentication,
    async (request, response) => {
      response.json(
        await sessionService.getSession(
          sessionIdSchema.parse(request.params.id),
          request.principal,
        ),
      );
    },
  );

  router.put('/sessions/:id', ...privileged, async (request, response) => {
    response.json(
      await sessionService.updateSession(
        authenticatedPrincipal(request),
        sessionIdSchema.parse(request.params.id),
        updateSessionSchema.parse(request.body),
      ),
    );
  });

  router.delete('/sessions/:id', ...privileged, async (request, response) => {
    await sessionService.deleteSession(
      authenticatedPrincipal(request),
      sessionIdSchema.parse(request.params.id),
    );
    response.status(204).send();
  });

  router.post(
    '/sessions/:id/cancel',
    ...privileged,
    async (request, response) => {
      response.json(
        await sessionService.cancelSession(
          authenticatedPrincipal(request),
          sessionIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.put(
    '/sessions/:id/trainers',
    ...privileged,
    async (request, response) => {
      const input = assignSessionTrainersSchema.parse(request.body);
      response.json(
        await sessionService.assignTrainers(
          authenticatedPrincipal(request),
          sessionIdSchema.parse(request.params.id),
          input.assignedTrainerIds,
        ),
      );
    },
  );

  router.post(
    '/sessions/:id/start',
    ...privileged,
    async (request, response) => {
      response.json(
        await sessionService.startSession(
          authenticatedPrincipal(request),
          sessionIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.post(
    '/sessions/:id/complete',
    ...privileged,
    async (request, response) => {
      response.json(
        await sessionService.completeSession(
          authenticatedPrincipal(request),
          sessionIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.post(
    '/sessions/:id/schedules',
    ...privileged,
    async (request, response) => {
      response
        .status(201)
        .json(
          await sessionService.createSchedule(
            authenticatedPrincipal(request),
            sessionIdSchema.parse(request.params.id),
            createScheduleSchema.parse(request.body),
          ),
        );
    },
  );

  router.put('/schedules/:id', ...privileged, async (request, response) => {
    response.json(
      await sessionService.updateSchedule(
        authenticatedPrincipal(request),
        sessionIdSchema.parse(request.params.id),
        updateScheduleSchema.parse(request.body),
      ),
    );
  });

  router.delete('/schedules/:id', ...privileged, async (request, response) => {
    await sessionService.deleteSchedule(
      authenticatedPrincipal(request),
      sessionIdSchema.parse(request.params.id),
    );
    response.status(204).send();
  });

  return router;
}

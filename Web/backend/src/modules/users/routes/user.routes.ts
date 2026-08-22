import { Router, type RequestHandler } from 'express';
import { z } from 'zod';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  createTrainerSchema,
  paginationSchema,
  updateProfileSchema,
} from '../dto/user.dto.js';
import type { UserService } from '../services/user.service.js';

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid user identifier.');

const requireSelfOrAdmin: RequestHandler = (request, _response, next) => {
  const principal = authenticatedPrincipal(request);
  if (principal.role !== 'ADMIN' && principal.userId !== request.params.id) {
    next(
      new AppError(403, 'FORBIDDEN', 'You are not authorized for this user.'),
    );
    return;
  }
  next();
};

export function createUserRouter(
  userService: UserService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const authenticated = authenticate(tokenService);

  router.get(
    '/users',
    authenticated,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      const pagination = paginationSchema.parse(request.query);
      response.json(
        await userService.list(undefined, pagination.page, pagination.pageSize),
      );
    },
  );

  router.get(
    '/learners',
    authenticated,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      const pagination = paginationSchema.parse(request.query);
      response.json(
        await userService.list('LEARNER', pagination.page, pagination.pageSize),
      );
    },
  );

  router.get(
    '/learners/:id',
    authenticated,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      response.json(
        await userService.getById(
          objectIdSchema.parse(request.params.id),
          'LEARNER',
        ),
      );
    },
  );

  router.get(
    '/trainers',
    authenticated,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      const pagination = paginationSchema.parse(request.query);
      response.json(
        await userService.list('TRAINER', pagination.page, pagination.pageSize),
      );
    },
  );

  router.post(
    '/trainers',
    authenticated,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      response
        .status(201)
        .json(
          await userService.createTrainer(
            createTrainerSchema.parse(request.body),
          ),
        );
    },
  );

  router.get(
    '/trainers/:id',
    authenticated,
    requirePasswordChanged,
    requireSelfOrAdmin,
    async (request, response) => {
      response.json(
        await userService.getById(
          objectIdSchema.parse(request.params.id),
          'TRAINER',
        ),
      );
    },
  );

  router.put(
    '/trainers/:id',
    authenticated,
    requirePasswordChanged,
    requireSelfOrAdmin,
    async (request, response) => {
      response.json(
        await userService.updateProfile(
          objectIdSchema.parse(request.params.id),
          updateProfileSchema.parse(request.body),
        ),
      );
    },
  );

  router.post(
    '/trainers/:id/disable',
    authenticated,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      response.json(
        await userService.disableTrainer(
          objectIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  return router;
}

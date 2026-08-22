import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import { entityIdSchema } from '../../certificates/dto/certificate.dto.js';
import {
  createTrainingCostSchema,
  trainerCostListSchema,
  trainerCostPathSchema,
  trainerCostWriteSchema,
  trainingCostListSchema,
  updateTrainingCostSchema,
} from '../dto/cost.dto.js';
import type { CostService } from '../services/cost.service.js';

export function createCostRouter(
  service: CostService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const ready = [authenticate(tokenService), requirePasswordChanged] as const;

  router.get('/costs/trainers', ...ready, async (request, response) => {
    response.json(
      await service.listTrainerCosts(
        authenticatedPrincipal(request),
        trainerCostListSchema.parse(request.query),
      ),
    );
  });
  router.put(
    '/costs/trainers/:trainerId/:year/:month',
    ...ready,
    async (request, response) => {
      response.json(
        await service.upsertTrainerCost(
          authenticatedPrincipal(request),
          trainerCostPathSchema.parse(request.params),
          trainerCostWriteSchema.parse(request.body),
        ),
      );
    },
  );
  router.get('/costs/trainings', ...ready, async (request, response) => {
    response.json(
      await service.listTrainingCosts(
        authenticatedPrincipal(request),
        trainingCostListSchema.parse(request.query),
      ),
    );
  });
  router.post('/costs/trainings', ...ready, async (request, response) => {
    response
      .status(201)
      .json(
        await service.createTrainingCost(
          authenticatedPrincipal(request),
          createTrainingCostSchema.parse(request.body),
        ),
      );
  });
  router.put('/costs/trainings/:id', ...ready, async (request, response) => {
    response.json(
      await service.updateTrainingCost(
        authenticatedPrincipal(request),
        entityIdSchema.parse(request.params.id),
        updateTrainingCostSchema.parse(request.body),
      ),
    );
  });
  router.delete('/costs/trainings/:id', ...ready, async (request, response) => {
    await service.deleteTrainingCost(
      authenticatedPrincipal(request),
      entityIdSchema.parse(request.params.id),
    );
    response.status(204).send();
  });
  return router;
}

import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import { dashboardSearchSchema } from '../dto/search.dto.js';
import type { SearchService } from '../services/search.service.js';

export function createSearchRouter(
  service: SearchService,
  tokenService: TokenService,
): Router {
  const router = Router();
  router.get(
    '/search',
    authenticate(tokenService),
    requirePasswordChanged,
    async (request, response) => {
      response.json(
        await service.search(
          authenticatedPrincipal(request),
          dashboardSearchSchema.parse(request.query),
        ),
      );
    },
  );
  return router;
}

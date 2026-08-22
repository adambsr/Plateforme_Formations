import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import { dashboardRangeSchema } from '../dto/dashboard.dto.js';
import type { DashboardService } from '../services/dashboard.service.js';

export function createDashboardRouter(
  service: DashboardService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const ready = [authenticate(tokenService), requirePasswordChanged] as const;
  const endpoints = {
    overview: service.overview.bind(service),
    participation: service.participation.bind(service),
    progress: service.progress.bind(service),
    satisfaction: service.satisfaction.bind(service),
    financial: service.financial.bind(service),
    profitability: service.profitability.bind(service),
  };
  for (const [name, handler] of Object.entries(endpoints)) {
    router.get(`/dashboard/${name}`, ...ready, async (request, response) => {
      response.json(
        await handler(
          authenticatedPrincipal(request),
          dashboardRangeSchema.parse(request.query),
        ),
      );
    });
  }
  return router;
}

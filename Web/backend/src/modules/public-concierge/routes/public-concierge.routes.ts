import { Router } from 'express';
import { rateLimit } from '../../../middleware/rate-limit.js';
import { publicConciergeMessageSchema } from '../dto/public-concierge.dto.js';
import type { PublicConciergeService } from '../services/public-concierge.service.js';

export function createPublicConciergeRouter(
  service: PublicConciergeService,
): Router {
  const router = Router();
  router.post(
    '/public/concierge/messages',
    rateLimit('public-concierge', 10, 15 * 60_000),
    async (request, response) => {
      const input = publicConciergeMessageSchema.parse(request.body);
      // Silently accept honeypot submissions without paying for an AI request.
      if (input.website !== undefined && input.website !== '')
        return response.json({
          answer: 'Merci pour votre message.',
          grounded: false,
          sources: [],
          actions: [],
          suggestedQuestions: [],
          metadata: {
            provider: 'NONE',
            model: 'NONE',
            retrievedPublicSourceCount: 0,
            contextChars: 0,
          },
        });
      response.json(await service.answer(input));
    },
  );
  return router;
}

import { Router } from 'express';

import { rateLimit } from '../../../middleware/rate-limit.js';
import { contactMessageSchema } from '../dto/contact.dto.js';
import type { ContactService } from '../services/contact.service.js';

export function createContactRouter(service: ContactService): Router {
  const router = Router();
  router.post(
    '/contact',
    rateLimit('contact', 5, 15 * 60_000),
    async (request, response) => {
      response
        .status(202)
        .json(await service.send(contactMessageSchema.parse(request.body)));
    },
  );
  return router;
}

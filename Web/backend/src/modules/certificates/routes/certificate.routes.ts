import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  certificateListSchema,
  entityIdSchema,
  generateCertificateSchema,
} from '../dto/certificate.dto.js';
import type { CertificateService } from '../services/certificate.service.js';

export function createCertificateRouter(
  service: CertificateService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const ready = [authenticate(tokenService), requirePasswordChanged] as const;

  router.get('/certificates', ...ready, async (request, response) => {
    response.json(
      await service.list(
        authenticatedPrincipal(request),
        certificateListSchema.parse(request.query),
      ),
    );
  });
  router.post('/certificates/generate', ...ready, async (request, response) => {
    response.json(
      await service.generate(
        authenticatedPrincipal(request),
        generateCertificateSchema.parse(request.body),
      ),
    );
  });
  router.get('/certificates/:id', ...ready, async (request, response) => {
    response.json(
      await service.get(
        authenticatedPrincipal(request),
        entityIdSchema.parse(request.params.id),
      ),
    );
  });
  router.get(
    '/certificates/:id/pdf',
    ...ready,
    async (request, response, next) => {
      const document = await service.downloadablePdf(
        authenticatedPrincipal(request),
        entityIdSchema.parse(request.params.id),
      );
      const encodedName = encodeURIComponent(document.filename).replaceAll(
        String.fromCharCode(39),
        '%27',
      );
      response.setHeader('content-type', 'application/pdf');
      response.setHeader(
        'content-disposition',
        `attachment; filename=certificate.pdf; filename*=UTF-8''${encodedName}`,
      );
      response.setHeader('x-content-type-options', 'nosniff');
      response.sendFile(document.absolutePath, (error) => {
        if (error !== undefined) next(error);
      });
    },
  );
  return router;
}

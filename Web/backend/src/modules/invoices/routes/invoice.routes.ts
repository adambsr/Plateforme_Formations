import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  invoiceListSchema,
  paymentIdSchema,
} from '../../payments/dto/payment.dto.js';
import type { InvoiceService } from '../services/invoice.service.js';

export function createInvoiceRouter(
  invoiceService: InvoiceService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const ready = [authenticate(tokenService), requirePasswordChanged] as const;
  router.get('/invoices', ...ready, async (request, response) => {
    response.json(
      await invoiceService.list(
        authenticatedPrincipal(request),
        invoiceListSchema.parse(request.query),
      ),
    );
  });
  router.get('/invoices/:id', ...ready, async (request, response) => {
    response.json(
      await invoiceService.get(
        authenticatedPrincipal(request),
        paymentIdSchema.parse(request.params.id),
      ),
    );
  });
  router.get('/invoices/:id/pdf', ...ready, async (request, response, next) => {
    const document = await invoiceService.downloadablePdf(
      authenticatedPrincipal(request),
      paymentIdSchema.parse(request.params.id),
    );
    const encodedName = encodeURIComponent(document.filename).replaceAll(
      "'",
      '%27',
    );
    response.setHeader('content-type', 'application/pdf');
    response.setHeader(
      'content-disposition',
      `attachment; filename="invoice.pdf"; filename*=UTF-8''${encodedName}`,
    );
    response.setHeader('x-content-type-options', 'nosniff');
    response.sendFile(document.absolutePath, (error) => {
      if (error !== undefined) next(error);
    });
  });
  return router;
}

import { Router } from 'express';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  registerDeviceSchema,
  sendNotificationSchema,
  unregisterDeviceSchema,
} from '../dto/notification.dto.js';
import type { NotificationService } from '../services/notification.service.js';

export function createNotificationRouter(
  service: NotificationService,
  tokenService: TokenService,
): Router {
  const router = Router();
  const authenticated = [
    authenticate(tokenService),
    requirePasswordChanged,
  ] as const;

  router.post(
    '/notifications/devices',
    ...authenticated,
    async (request, response) => {
      response.status(201).json(
        await service.registerDevice(
          authenticatedPrincipal(request).userId,
          (() => {
            const input = registerDeviceSchema.parse(request.body);
            return {
              token: input.token,
              platform: input.platform,
              ...(input.appVersion === undefined
                ? {}
                : { appVersion: input.appVersion }),
            };
          })(),
        ),
      );
    },
  );
  router.delete(
    '/notifications/devices',
    ...authenticated,
    async (request, response) => {
      await service.unregisterDevice(
        authenticatedPrincipal(request).userId,
        unregisterDeviceSchema.parse(request.body).token,
      );
      response.status(204).send();
    },
  );
  router.post(
    '/notifications/send',
    ...authenticated,
    requireRoles('ADMIN'),
    async (request, response) => {
      response.json(
        await service.send(sendNotificationSchema.parse(request.body)),
      );
    },
  );
  return router;
}

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
  notificationIdSchema,
  notificationListSchema,
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

  router.get('/notifications', ...authenticated, async (request, response) => {
    response.json(
      await service.list(
        authenticatedPrincipal(request),
        notificationListSchema.parse(request.query),
      ),
    );
  });
  router.get(
    '/notifications/unread-count',
    ...authenticated,
    async (request, response) => {
      response.json(await service.unreadCount(authenticatedPrincipal(request)));
    },
  );
  router.get('/notifications/stream', ...authenticated, (request, response) => {
    const principal = authenticatedPrincipal(request);
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    response.write('retry: 3000\n');
    response.write('event: ready\ndata: {}\n\n');

    const unsubscribe = service.subscribe(principal.userId, (notification) => {
      if (response.writableEnded) return;
      response.write(`id: ${notification.id}\n`);
      response.write('event: notification\n');
      response.write(`data: ${JSON.stringify(notification)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      if (!response.writableEnded) response.write(': heartbeat\n\n');
    }, 25_000);
    heartbeat.unref();

    // Opening the live channel also materializes any due session reminder.
    void service.unreadCount(principal).catch(() => undefined);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
    };
    request.once('close', close);
    response.once('close', close);
  });
  router.patch(
    '/notifications/read-all',
    ...authenticated,
    async (request, response) => {
      response.json(await service.markAllRead(authenticatedPrincipal(request)));
    },
  );
  router.patch(
    '/notifications/:id/read',
    ...authenticated,
    async (request, response) => {
      const { id } = notificationIdSchema.parse(request.params);
      response.json(
        await service.markRead(authenticatedPrincipal(request), id),
      );
    },
  );

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

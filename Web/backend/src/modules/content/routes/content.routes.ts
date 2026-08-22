import { Router, type RequestHandler } from 'express';
import multer from 'multer';

import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  EnrollmentAccessService,
  requirePaidTrainingAccess,
} from '../../enrollments/services/enrollment-access.service.js';
import {
  contentIdSchema,
  createLessonSchema,
  createModuleSchema,
  createResourceSchema,
  updateLessonSchema,
  updateModuleSchema,
  updateResourceSchema,
} from '../dto/content.dto.js';
import type { ContentService } from '../services/content.service.js';

function uploadMiddleware(maximumBytes: number): RequestHandler {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maximumBytes, files: 1, fields: 20 },
  }).single('file');
  return (request, response, next) => {
    receive(request, response, (error: unknown) => {
      if (error === undefined) {
        next();
        return;
      }
      if (error instanceof multer.MulterError) {
        next(
          new AppError(
            error.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
            error.code === 'LIMIT_FILE_SIZE'
              ? 'FILE_TOO_LARGE'
              : 'INVALID_MULTIPART_UPLOAD',
            error.code === 'LIMIT_FILE_SIZE'
              ? 'The uploaded file exceeds the configured size limit.'
              : 'The multipart upload is invalid.',
          ),
        );
        return;
      }
      next(error);
    });
  };
}

export function createContentRouter(
  contentService: ContentService,
  tokenService: TokenService,
  maximumUploadBytes: number,
  enrollmentAccess: EnrollmentAccessService,
): Router {
  const router = Router();
  const authenticated = authenticate(tokenService);
  const canMutate = [
    authenticated,
    requirePasswordChanged,
    requirePaidTrainingAccess(enrollmentAccess),
    requireRoles('ADMIN', 'TRAINER'),
  ] as const;

  router.get(
    '/trainings/:id/content',
    authenticated,
    requirePasswordChanged,
    async (request, response) => {
      response.json(
        await contentService.getTrainingContent(
          authenticatedPrincipal(request),
          contentIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.post(
    '/trainings/:id/modules',
    ...canMutate,
    async (request, response) => {
      response
        .status(201)
        .json(
          await contentService.createModule(
            authenticatedPrincipal(request),
            contentIdSchema.parse(request.params.id),
            createModuleSchema.parse(request.body),
          ),
        );
    },
  );

  router.put('/modules/:id', ...canMutate, async (request, response) => {
    response.json(
      await contentService.updateModule(
        authenticatedPrincipal(request),
        contentIdSchema.parse(request.params.id),
        updateModuleSchema.parse(request.body),
      ),
    );
  });

  router.delete('/modules/:id', ...canMutate, async (request, response) => {
    await contentService.deleteModule(
      authenticatedPrincipal(request),
      contentIdSchema.parse(request.params.id),
    );
    response.status(204).send();
  });

  router.post(
    '/modules/:id/lessons',
    ...canMutate,
    async (request, response) => {
      response
        .status(201)
        .json(
          await contentService.createLesson(
            authenticatedPrincipal(request),
            contentIdSchema.parse(request.params.id),
            createLessonSchema.parse(request.body),
          ),
        );
    },
  );

  router.put('/lessons/:id', ...canMutate, async (request, response) => {
    response.json(
      await contentService.updateLesson(
        authenticatedPrincipal(request),
        contentIdSchema.parse(request.params.id),
        updateLessonSchema.parse(request.body),
      ),
    );
  });

  router.delete('/lessons/:id', ...canMutate, async (request, response) => {
    await contentService.deleteLesson(
      authenticatedPrincipal(request),
      contentIdSchema.parse(request.params.id),
    );
    response.status(204).send();
  });

  router.post(
    '/lessons/:id/resources',
    ...canMutate,
    uploadMiddleware(maximumUploadBytes),
    async (request, response) => {
      response
        .status(201)
        .json(
          await contentService.createResource(
            authenticatedPrincipal(request),
            contentIdSchema.parse(request.params.id),
            createResourceSchema.parse(request.body),
            request.file,
          ),
        );
    },
  );

  router.put('/resources/:id', ...canMutate, async (request, response) => {
    response.json(
      await contentService.updateResource(
        authenticatedPrincipal(request),
        contentIdSchema.parse(request.params.id),
        updateResourceSchema.parse(request.body),
      ),
    );
  });

  router.delete('/resources/:id', ...canMutate, async (request, response) => {
    await contentService.deleteResource(
      authenticatedPrincipal(request),
      contentIdSchema.parse(request.params.id),
    );
    response.status(204).send();
  });

  router.get(
    '/resources/:id/download',
    authenticated,
    requirePasswordChanged,
    async (request, response, next) => {
      const file = await contentService.downloadableFile(
        authenticatedPrincipal(request),
        contentIdSchema.parse(request.params.id),
      );
      const encodedName = encodeURIComponent(file.originalName).replaceAll(
        "'",
        '%27',
      );
      response.setHeader('content-type', file.mimeType);
      response.setHeader(
        'content-disposition',
        `attachment; filename="download"; filename*=UTF-8''${encodedName}`,
      );
      response.setHeader('x-content-type-options', 'nosniff');
      response.sendFile(file.absolutePath, (error) => {
        if (error !== undefined) next(error);
      });
    },
  );

  return router;
}

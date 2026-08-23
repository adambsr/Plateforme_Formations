import { Router, type RequestHandler } from 'express';
import multer from 'multer';

import {
  authenticate,
  authenticateIfPresent,
  authenticatedPrincipal,
  requirePasswordChanged,
  requireRoles,
} from '../../../middleware/authentication.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { TokenService } from '../../auth/services/token.service.js';
import {
  categoryListSchema,
  createCategorySchema,
  createTrainingSchema,
  trainingIdSchema,
  trainingListSchema,
  transferTrainingOwnerSchema,
  updateCategorySchema,
  updateTrainingSchema,
} from '../dto/training.dto.js';
import type { TrainingService } from '../services/training.service.js';

function thumbnailUpload(maximumBytes: number): RequestHandler {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maximumBytes, files: 1, fields: 2 },
  }).single('thumbnail');
  return (request, _response, next) => {
    receive(request, _response, (error: unknown) => {
      if (error === undefined) return next();
      if (error instanceof multer.MulterError) {
        return next(
          new AppError(
            error.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
            error.code === 'LIMIT_FILE_SIZE'
              ? 'FILE_TOO_LARGE'
              : 'INVALID_MULTIPART_UPLOAD',
            error.code === 'LIMIT_FILE_SIZE'
              ? 'L’image dépasse la taille maximale autorisée.'
              : 'Le téléversement de la miniature est invalide.',
          ),
        );
      }
      next(error);
    });
  };
}

export function createTrainingRouter(
  trainingService: TrainingService,
  tokenService: TokenService,
  maximumUploadBytes: number,
): Router {
  const router = Router();
  const optionalAuthentication = authenticateIfPresent(tokenService);
  const requiredAuthentication = authenticate(tokenService);

  router.get(
    '/categories',
    optionalAuthentication,
    async (request, response) => {
      const query = categoryListSchema.parse(request.query);
      response.json(
        await trainingService.listCategories(
          query.includeArchived,
          request.principal,
        ),
      );
    },
  );

  router.post(
    '/categories',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      response
        .status(201)
        .json(
          await trainingService.createCategory(
            authenticatedPrincipal(request),
            createCategorySchema.parse(request.body),
          ),
        );
    },
  );

  router.put(
    '/categories/:id',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      response.json(
        await trainingService.updateCategory(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
          updateCategorySchema.parse(request.body),
        ),
      );
    },
  );

  router.get(
    '/trainings',
    optionalAuthentication,
    async (request, response) => {
      response.json(
        await trainingService.listTrainings(
          trainingListSchema.parse(request.query),
          request.principal,
        ),
      );
    },
  );

  router.post(
    '/trainings',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response
        .status(201)
        .json(
          await trainingService.createTraining(
            authenticatedPrincipal(request),
            createTrainingSchema.parse(request.body),
          ),
        );
    },
  );

  router.get(
    '/trainings/:id',
    optionalAuthentication,
    async (request, response) => {
      response.json(
        await trainingService.getTraining(
          trainingIdSchema.parse(request.params.id),
          request.principal,
        ),
      );
    },
  );

  router.get(
    '/trainings/:id/thumbnail',
    optionalAuthentication,
    async (request, response, next) => {
      const file = await trainingService.thumbnailFile(
        trainingIdSchema.parse(request.params.id),
        request.principal,
      );
      response.setHeader('content-type', file.mimeType);
      response.setHeader('cache-control', 'public, max-age=86400, immutable');
      response.setHeader('content-disposition', 'inline');
      response.sendFile(file.absolutePath, (error) => {
        if (error !== undefined) next(error);
      });
    },
  );

  router.put(
    '/trainings/:id/thumbnail',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    thumbnailUpload(maximumUploadBytes),
    async (request, response) => {
      response.json(
        await trainingService.uploadThumbnail(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
          request.file,
        ),
      );
    },
  );

  router.delete(
    '/trainings/:id/thumbnail',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response.json(
        await trainingService.removeThumbnail(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.put(
    '/trainings/:id',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response.json(
        await trainingService.updateTraining(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
          updateTrainingSchema.parse(request.body),
        ),
      );
    },
  );

  router.delete(
    '/trainings/:id',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      await trainingService.deleteTraining(
        authenticatedPrincipal(request),
        trainingIdSchema.parse(request.params.id),
      );
      response.status(204).send();
    },
  );

  router.post(
    '/trainings/:id/publish',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response.json(
        await trainingService.publishTraining(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.post(
    '/trainings/:id/archive',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response.json(
        await trainingService.archiveTraining(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.post(
    '/trainings/:id/unarchive',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN', 'TRAINER'),
    async (request, response) => {
      response.json(
        await trainingService.unarchiveTraining(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
        ),
      );
    },
  );

  router.put(
    '/trainings/:id/owner',
    requiredAuthentication,
    requirePasswordChanged,
    requireRoles('ADMIN'),
    async (request, response) => {
      const input = transferTrainingOwnerSchema.parse(request.body);
      response.json(
        await trainingService.transferOwnership(
          authenticatedPrincipal(request),
          trainingIdSchema.parse(request.params.id),
          input.ownerTrainerId,
        ),
      );
    },
  );

  return router;
}

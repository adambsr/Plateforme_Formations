import type { RequestHandler } from 'express';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EnrollmentModel } from '../models/enrollment.model.js';

export class EnrollmentAccessService {
  async hasTrainingAccess(
    learnerId: string,
    trainingId: string,
  ): Promise<boolean> {
    return (await EnrollmentModel.exists({ learnerId, trainingId })) !== null;
  }

  async assertTrainingAccess(
    learnerId: string,
    trainingId: string,
  ): Promise<void> {
    if (!(await this.hasTrainingAccess(learnerId, trainingId))) {
      throw new AppError(
        403,
        'ENROLLMENT_REQUIRED',
        'A paid Enrollment is required to access this Training.',
      );
    }
  }
}

export function requirePaidTrainingAccess(
  accessService: EnrollmentAccessService,
): RequestHandler {
  return async (request, _response, next) => {
    const principal = request.principal as AuthenticatedPrincipal | undefined;
    if (principal === undefined || principal.role !== 'LEARNER') {
      next();
      return;
    }
    try {
      await accessService.assertTrainingAccess(
        principal.userId,
        String(request.params.id),
      );
      next();
    } catch (error) {
      next(error);
    }
  };
}

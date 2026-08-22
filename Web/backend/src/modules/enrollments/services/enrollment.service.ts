import type { QueryFilter } from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { EnrollmentListInput } from '../../payments/dto/payment.dto.js';
import { PaymentModel } from '../../payments/models/payment.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import {
  EnrollmentModel,
  type Enrollment,
} from '../models/enrollment.model.js';

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

export class EnrollmentService {
  async list(principal: AuthenticatedPrincipal, input: EnrollmentListInput) {
    passwordReady(principal);
    if (principal.role === 'TRAINER') {
      throw new AppError(
        403,
        'ENROLLMENT_LIST_FORBIDDEN',
        'Trainers do not have financial Enrollment-list access.',
      );
    }
    const filter: QueryFilter<Enrollment> = {
      ...(principal.role === 'LEARNER' ? { learnerId: principal.userId } : {}),
      ...(input.trainingId === undefined
        ? {}
        : { trainingId: input.trainingId }),
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    };
    const [enrollments, total] = await Promise.all([
      EnrollmentModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      EnrollmentModel.countDocuments(filter),
    ]);
    return {
      items: await this.#views(enrollments),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async get(principal: AuthenticatedPrincipal, enrollmentId: string) {
    passwordReady(principal);
    const enrollment = await EnrollmentModel.findById(enrollmentId).exec();
    if (
      enrollment === null ||
      (principal.role === 'LEARNER' &&
        String(enrollment.learnerId) !== principal.userId)
    ) {
      throw new AppError(
        404,
        'ENROLLMENT_NOT_FOUND',
        'The Enrollment does not exist.',
      );
    }
    if (principal.role === 'TRAINER') {
      throw new AppError(
        403,
        'ENROLLMENT_ACCESS_FORBIDDEN',
        'Trainers do not have financial Enrollment access.',
      );
    }
    return (await this.#views([enrollment]))[0];
  }

  async #views(enrollments: readonly EnrollmentModelDocument[]) {
    const learnerIds = [
      ...new Set(enrollments.map(({ learnerId }) => String(learnerId))),
    ];
    const trainingIds = [
      ...new Set(enrollments.map(({ trainingId }) => String(trainingId))),
    ];
    const sessionIds = enrollments.flatMap(({ sessionId }) =>
      sessionId === undefined || sessionId === null ? [] : [String(sessionId)],
    );
    const paymentIds = enrollments.map(({ paymentId }) => paymentId);
    const [learners, trainings, sessions, payments] = await Promise.all([
      UserModel.find({ _id: { $in: learnerIds } }).exec(),
      TrainingModel.find({ _id: { $in: trainingIds } }).exec(),
      TrainingSessionModel.find({ _id: { $in: sessionIds } }).exec(),
      PaymentModel.find({ _id: { $in: paymentIds } }).exec(),
    ]);
    const learnerMap = new Map(
      learners.map((value) => [String(value._id), value]),
    );
    const trainingMap = new Map(
      trainings.map((value) => [String(value._id), value]),
    );
    const sessionMap = new Map(
      sessions.map((value) => [String(value._id), value]),
    );
    const paymentMap = new Map(
      payments.map((value) => [String(value._id), value]),
    );
    return enrollments.map((enrollment) => {
      const learner = learnerMap.get(String(enrollment.learnerId));
      const training = trainingMap.get(String(enrollment.trainingId));
      const payment = paymentMap.get(String(enrollment.paymentId));
      if (
        learner === undefined ||
        training === undefined ||
        payment === undefined
      ) {
        throw new Error('Enrollment references are inconsistent.');
      }
      const session =
        enrollment.sessionId === undefined || enrollment.sessionId === null
          ? undefined
          : sessionMap.get(String(enrollment.sessionId));
      return {
        id: String(enrollment._id),
        learner: {
          id: String(learner._id),
          email: learner.email,
          ...learner.profile,
        },
        training: { id: String(training._id), title: training.title },
        ...(session === undefined
          ? {}
          : { session: { id: String(session._id), title: session.title } }),
        payment: {
          id: String(payment._id),
          amountMinor: payment.amountMinor,
          currency: payment.currency,
        },
        createdAt: enrollment.createdAt.toISOString(),
      };
    });
  }
}

type EnrollmentModelDocument =
  Awaited<ReturnType<(typeof EnrollmentModel)['findById']>> extends never
    ? never
    : import('mongoose').HydratedDocument<Enrollment>;

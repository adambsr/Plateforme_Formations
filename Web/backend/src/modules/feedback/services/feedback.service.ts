import type { Types } from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EligibilityService } from '../../completion/services/eligibility.service.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import type { CreateFeedbackInput } from '../dto/feedback.dto.js';
import { FeedbackModel } from '../models/feedback.model.js';

function passwordReady(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
}

function distribution() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export class FeedbackService {
  readonly #eligibility: EligibilityService;

  constructor(eligibility: EligibilityService) {
    this.#eligibility = eligibility;
  }

  async create(principal: AuthenticatedPrincipal, input: CreateFeedbackInput) {
    passwordReady(principal);
    if (principal.role !== 'LEARNER') {
      throw new AppError(
        403,
        'LEARNER_FEEDBACK_REQUIRED',
        'Only the enrolled Learner can create Feedback.',
      );
    }
    const enrollment = await EnrollmentModel.findOne({
      _id: input.enrollmentId,
      learnerId: principal.userId,
    }).exec();
    if (enrollment === null) {
      throw new AppError(
        404,
        'ENROLLMENT_NOT_FOUND',
        'The owned Enrollment does not exist.',
      );
    }
    const eligibility = await this.#eligibility.evaluate(input.enrollmentId);
    if (!eligibility.eligible) {
      throw new AppError(
        409,
        'FEEDBACK_NOT_ELIGIBLE',
        eligibility.failures.includes('TRAINING_INCOMPLETE')
          ? 'The Training completion requirements are not satisfied.'
          : 'The certifying Evaluation has not been passed.',
      );
    }
    try {
      const feedback = await FeedbackModel.create({
        enrollmentId: enrollment._id,
        trainingId: enrollment.trainingId,
        learnerId: enrollment.learnerId,
        rating: input.rating,
      });
      return {
        id: String(feedback._id),
        enrollmentId: String(feedback.enrollmentId),
        trainingId: String(feedback.trainingId),
        rating: feedback.rating,
        createdAt: feedback.createdAt.toISOString(),
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          'FEEDBACK_ALREADY_EXISTS',
          'Feedback is immutable and already exists for this Enrollment.',
        );
      }
      throw error;
    }
  }

  async statistics(principal: AuthenticatedPrincipal) {
    passwordReady(principal);
    if (principal.role !== 'ADMIN') {
      throw new AppError(
        403,
        'ADMIN_FEEDBACK_REQUIRED',
        'Feedback statistics are available only to the Admin.',
      );
    }
    const rows = await FeedbackModel.aggregate<{
      _id: { trainingId: Types.ObjectId; rating: number };
      count: number;
    }>([
      {
        $group: {
          _id: { trainingId: '$trainingId', rating: '$rating' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.trainingId': 1, '_id.rating': 1 } },
    ]);
    const trainingIds = [
      ...new Set(rows.map(({ _id }) => String(_id.trainingId))),
    ];
    const trainings = await TrainingModel.find({
      _id: { $in: trainingIds },
    }).exec();
    const titles = new Map(
      trainings.map((training) => [String(training._id), training.title]),
    );
    const globalDistribution = distribution();
    const grouped = new Map<
      string,
      { title: string; distribution: ReturnType<typeof distribution> }
    >();
    for (const row of rows) {
      const trainingId = String(row._id.trainingId);
      const rating = row._id.rating as 1 | 2 | 3 | 4 | 5;
      globalDistribution[rating] += row.count;
      const current = grouped.get(trainingId) ?? {
        title: titles.get(trainingId) ?? 'Training archived',
        distribution: distribution(),
      };
      current.distribution[rating] += row.count;
      grouped.set(trainingId, current);
    }
    const summary = (values: ReturnType<typeof distribution>) => {
      const count = Object.values(values).reduce(
        (sum, value) => sum + value,
        0,
      );
      const weighted = Object.entries(values).reduce(
        (sum, [rating, value]) => sum + Number(rating) * value,
        0,
      );
      return {
        count,
        average: count === 0 ? null : Number((weighted / count).toFixed(2)),
        distribution: values,
      };
    };
    return {
      global: summary(globalDistribution),
      byTraining: [...grouped.entries()]
        .map(([trainingId, value]) => ({
          training: { id: trainingId, title: value.title },
          ...summary(value.distribution),
        }))
        .sort((left, right) =>
          left.training.title.localeCompare(right.training.title),
        ),
    };
  }
}

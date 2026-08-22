import type { HydratedDocument } from 'mongoose';

import {
  EnrollmentModel,
  type Enrollment,
} from '../../enrollments/models/enrollment.model.js';
import { EvaluationAttemptModel } from '../../evaluations/models/evaluation-attempt.model.js';
import { EvaluationModel } from '../../evaluations/models/evaluation.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import {
  TrainingModel,
  type Training,
} from '../../trainings/models/training.model.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { CompletionService } from './completion.service.js';

export type EligibilityFailure =
  'TRAINING_INCOMPLETE' | 'CERTIFYING_EVALUATION_NOT_PASSED';

export interface EligibilityResult {
  eligible: boolean;
  failures: EligibilityFailure[];
  enrollment: HydratedDocument<Enrollment>;
  training: HydratedDocument<Training>;
  completion: {
    percentage: number;
    completedAt?: Date;
    modality: 'SELF_PACED_ONLINE' | 'IN_PERSON';
  };
  certifyingEvaluation?: {
    id: string;
    title: string;
    passedAttemptId?: string;
    passedAt?: Date;
  };
}

export class EligibilityService {
  readonly #completion: CompletionService;

  constructor(completion = new CompletionService()) {
    this.#completion = completion;
  }

  async evaluate(enrollmentId: string): Promise<EligibilityResult> {
    const enrollment = await EnrollmentModel.findById(enrollmentId).exec();
    if (enrollment === null) {
      throw new AppError(
        404,
        'ENROLLMENT_NOT_FOUND',
        'The Enrollment does not exist.',
      );
    }
    const training = await TrainingModel.findById(enrollment.trainingId).exec();
    if (training === null) {
      throw new Error('Enrollment Training reference is inconsistent.');
    }

    let completion: EligibilityResult['completion'];
    let isComplete: boolean;
    if (training.type === 'SELF_PACED_ONLINE') {
      const value = await this.#completion.selfPaced(enrollment._id);
      const dates = value.lessons.flatMap(({ completedAt }) =>
        completedAt === undefined ? [] : [new Date(completedAt)],
      );
      completion = {
        percentage: value.percentage,
        ...(dates.length === 0
          ? {}
          : {
              completedAt: new Date(
                Math.max(...dates.map((value) => value.getTime())),
              ),
            }),
        modality: training.type,
      };
      isComplete = value.isComplete;
    } else {
      const value = await this.#completion.inPerson(enrollment._id);
      const session = await TrainingSessionModel.findById(
        value.sessionId,
      ).exec();
      if (session === null) {
        throw new Error('Enrollment Session reference is inconsistent.');
      }
      completion = {
        percentage: value.attendancePercentage,
        ...(value.isComplete ? { completedAt: session.updatedAt } : {}),
        modality: training.type,
      };
      isComplete = value.isComplete;
    }

    const failures: EligibilityFailure[] = [];
    if (!isComplete) failures.push('TRAINING_INCOMPLETE');
    let certifyingEvaluation: EligibilityResult['certifyingEvaluation'];
    if (training.certifyingEvaluationId !== undefined) {
      const evaluation = await EvaluationModel.findById(
        training.certifyingEvaluationId,
      ).exec();
      if (evaluation === null) {
        throw new Error('Certifying Evaluation reference is inconsistent.');
      }
      const passedAttempt = await EvaluationAttemptModel.findOne({
        enrollmentId: enrollment._id,
        evaluationId: evaluation._id,
        status: 'PASSED',
      })
        .sort({ submittedAt: 1, _id: 1 })
        .exec();
      certifyingEvaluation = {
        id: String(evaluation._id),
        title: evaluation.title,
        ...(passedAttempt === null
          ? {}
          : {
              passedAttemptId: String(passedAttempt._id),
              passedAt: passedAttempt.submittedAt ?? passedAttempt.updatedAt,
            }),
      };
      if (passedAttempt === null) {
        failures.push('CERTIFYING_EVALUATION_NOT_PASSED');
      }
    }

    return {
      eligible: failures.length === 0,
      failures,
      enrollment,
      training,
      completion,
      ...(certifyingEvaluation === undefined ? {} : { certifyingEvaluation }),
    };
  }
}

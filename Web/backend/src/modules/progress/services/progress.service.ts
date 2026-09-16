import mongoose, { type QueryFilter } from 'mongoose';
import type { Logger } from 'pino';

import { deliverBestEffort } from '../../../infrastructure/mail/email-delivery.js';
import type { TransactionalEmailService } from '../../../infrastructure/mail/email-service.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { CompletionService } from '../../completion/services/completion.service.js';
import { LessonModel } from '../../content/models/lesson.model.js';
import { TrainingModuleModel } from '../../content/models/training-module.model.js';
import {
  EnrollmentModel,
  type Enrollment,
} from '../../enrollments/models/enrollment.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type { NotificationService } from '../../notifications/services/notification.service.js';
import type {
  ProgressListInput,
  UpdateLessonProgressInput,
} from '../dto/progress.dto.js';
import { LessonProgressModel } from '../models/lesson-progress.model.js';

function assertLearner(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
  if (principal.role !== 'LEARNER') {
    throw new AppError(
      403,
      'LEARNER_PROGRESS_REQUIRED',
      'Progress is available only to the enrolled Learner.',
    );
  }
}

export class ProgressService {
  readonly #completion: CompletionService;
  readonly #mail: TransactionalEmailService;
  readonly #logger: Logger;
  readonly #notifications: NotificationService | undefined;

  constructor(
    completion: CompletionService,
    mail: TransactionalEmailService,
    logger: Logger,
    notifications?: NotificationService,
  ) {
    this.#completion = completion;
    this.#mail = mail;
    this.#logger = logger;
    this.#notifications = notifications;
  }

  async list(principal: AuthenticatedPrincipal, input: ProgressListInput) {
    assertLearner(principal);
    const selfPacedTrainingIds = await TrainingModel.find({
      type: 'SELF_PACED_ONLINE',
      ...(input.trainingId === undefined ? {} : { _id: input.trainingId }),
    }).distinct('_id');
    const filter: QueryFilter<Enrollment> = {
      learnerId: principal.userId,
      sessionId: null,
      trainingId: { $in: selfPacedTrainingIds },
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
      items: await Promise.all(
        enrollments.map(({ _id }) => this.#completion.selfPaced(_id)),
      ),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async updateLesson(
    principal: AuthenticatedPrincipal,
    lessonId: string,
    input: UpdateLessonProgressInput,
  ) {
    assertLearner(principal);
    const lesson = await LessonModel.findOne({
      _id: lessonId,
      isArchived: false,
    }).exec();
    if (lesson === null) throw this.#lessonNotFound();
    const [module, training, enrollment] = await Promise.all([
      TrainingModuleModel.findOne({
        _id: lesson.moduleId,
        trainingId: lesson.trainingId,
        isArchived: false,
      }).exec(),
      TrainingModel.findById(lesson.trainingId).exec(),
      EnrollmentModel.findOne({
        learnerId: principal.userId,
        trainingId: lesson.trainingId,
        sessionId: null,
      }).exec(),
    ]);
    if (module === null) throw this.#lessonNotFound();
    if (training === null || training.type !== 'SELF_PACED_ONLINE') {
      throw new AppError(
        409,
        'SELF_PACED_TRAINING_REQUIRED',
        'Lesson progress is available only for self-paced Trainings.',
      );
    }
    if (enrollment === null) {
      throw new AppError(
        403,
        'PAID_ENROLLMENT_REQUIRED',
        'A paid self-paced Enrollment is required to update progress.',
      );
    }
    const certificate = await mongoose.connection
      .collection('certificates')
      .findOne({ enrollmentId: enrollment._id }, { projection: { _id: 1 } });
    if (certificate !== null) {
      throw new AppError(
        409,
        'CERTIFICATE_PROGRESS_LOCKED',
        'Lesson progress is immutable after Certificate issuance.',
      );
    }
    const wasComplete = input.completed
      ? (await this.#completion.selfPaced(enrollment._id)).isComplete
      : false;
    const existing = await LessonProgressModel.findOne({
      enrollmentId: enrollment._id,
      lessonId: lesson._id,
    }).exec();
    if (existing === null) {
      try {
        await LessonProgressModel.create({
          enrollmentId: enrollment._id,
          learnerId: enrollment.learnerId,
          trainingId: enrollment.trainingId,
          lessonId: lesson._id,
          completed: input.completed,
          completedAt: input.completed ? new Date() : null,
        });
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const concurrent = await LessonProgressModel.findOne({
          enrollmentId: enrollment._id,
          lessonId: lesson._id,
        }).exec();
        if (concurrent === null) throw error;
        if (concurrent.completed !== input.completed) {
          concurrent.completed = input.completed;
          concurrent.completedAt = input.completed ? new Date() : null;
          await concurrent.save();
        }
      }
    } else if (existing.completed !== input.completed) {
      existing.completed = input.completed;
      existing.completedAt = input.completed ? new Date() : null;
      await existing.save();
    }
    const completion = await this.#completion.selfPaced(enrollment._id);
    if (input.completed && !wasComplete && completion.isComplete) {
      await deliverBestEffort(
        this.#logger,
        'training-completed-notification',
        async () => {
          await this.#notifications?.createInApp({
            recipientUserId: principal.userId,
            type: 'TRAINING_COMPLETED',
            title: 'Formation terminée',
            message: `Félicitations pour avoir terminé « ${training.title} ».`,
            link: '/app/progress',
            dedupeKey: `training-completed:${String(enrollment._id)}`,
            metadata: {
              enrollmentId: String(enrollment._id),
              trainingId: String(training._id),
            },
          });
        },
      );
      await deliverBestEffort(this.#logger, 'training-completed', async () => {
        const learner = await UserModel.findById(enrollment.learnerId).exec();
        if (learner !== null) {
          await this.#mail.sendTrainingCompleted({
            email: learner.email,
            ...(learner.profile.firstName === undefined
              ? {}
              : { firstName: learner.profile.firstName }),
            trainingTitle: training.title,
          });
        }
      });
    }
    return completion;
  }

  #lessonNotFound(): AppError {
    return new AppError(
      404,
      'LESSON_NOT_FOUND',
      'The active Lesson does not exist.',
    );
  }
}

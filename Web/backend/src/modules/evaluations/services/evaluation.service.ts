import mongoose, { type HydratedDocument, type QueryFilter } from 'mongoose';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import {
  questionInputSchema,
  type CreateEvaluationInput,
  type EvaluationListInput,
  type QuestionInput,
  type SaveAnswerInput,
  type UpdateEvaluationInput,
  type UpdateQuestionInput,
} from '../dto/evaluation.dto.js';
import { EvaluationAnswerModel } from '../models/evaluation-answer.model.js';
import {
  EvaluationAttemptModel,
  type EvaluationAttempt,
} from '../models/evaluation-attempt.model.js';
import {
  EvaluationModel,
  type Evaluation,
} from '../models/evaluation.model.js';
import { EvaluationQuestionModel } from '../models/evaluation-question.model.js';

function ready(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword)
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
}
function sameSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

export class EvaluationService {
  async ownedDraftForGeneration(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
  ) {
    const evaluation = await this.#ownedDraft(principal, evaluationId);
    return {
      evaluationId: String(evaluation._id),
      trainingId: String(evaluation.trainingId),
      title: evaluation.title,
    };
  }

  async importGeneratedQuestions(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
    questions: QuestionInput[],
    metadata: {
      provider: string;
      model: string;
      contextChars: number;
      resourceCount: number;
      skippedResourceCount: number;
    },
  ) {
    const evaluation = await this.#ownedDraft(principal, evaluationId);
    const last = await EvaluationQuestionModel.findOne({
      evaluationId: evaluation._id,
    })
      .sort({ order: -1 })
      .select('order')
      .exec();
    const validated = questions.map((question, index) =>
      questionInputSchema.parse({
        ...question,
        order: (last?.order ?? 0) + index + 1,
      }),
    );
    await mongoose.connection.transaction(async (session) => {
      await EvaluationQuestionModel.insertMany(
        validated.map((question) => ({
          ...question,
          evaluationId: evaluation._id,
          trainingId: evaluation.trainingId,
        })),
        { session },
      );
      const updated = await EvaluationModel.updateOne(
        { _id: evaluation._id, status: 'DRAFT' },
        { $set: { aiGeneration: { ...metadata, generatedAt: new Date() } } },
        { session },
      );
      if (updated.modifiedCount !== 1)
        throw new AppError(
          409,
          'DRAFT_EVALUATION_REQUIRED',
          'The Evaluation changed before generated questions could be imported.',
        );
    });
    return this.detail(principal, evaluationId);
  }

  async list(principal: AuthenticatedPrincipal, input: EvaluationListInput) {
    ready(principal);
    const filter: QueryFilter<Evaluation> = {};
    if (input.view === 'MANAGED') {
      if (principal.role === 'LEARNER')
        throw new AppError(
          403,
          'EVALUATION_MANAGEMENT_FORBIDDEN',
          'Evaluation management access is required.',
        );
      if (principal.role === 'TRAINER')
        filter.ownerTrainerId = new mongoose.Types.ObjectId(principal.userId);
    } else {
      if (principal.role !== 'LEARNER')
        throw new AppError(
          403,
          'LEARNER_ACCESS_REQUIRED',
          'Accessible Evaluations are a Learner view.',
        );
      const trainingIds = await EnrollmentModel.distinct('trainingId', {
        learnerId: principal.userId,
      });
      filter.trainingId = { $in: trainingIds };
      filter.status = input.status ?? { $in: ['PUBLISHED', 'ARCHIVED'] };
    }
    if (input.trainingId !== undefined)
      if (
        input.view === 'ACCESSIBLE' &&
        (await EnrollmentModel.exists({
          learnerId: principal.userId,
          trainingId: input.trainingId,
        })) === null
      )
        throw new AppError(
          403,
          'TRAINING_ENROLLMENT_REQUIRED',
          'A paid Enrollment in this Training is required.',
        );
    if (input.trainingId !== undefined)
      filter.trainingId = new mongoose.Types.ObjectId(input.trainingId);
    if (input.status !== undefined) filter.status = input.status;
    const [items, total] = await Promise.all([
      EvaluationModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      EvaluationModel.countDocuments(filter),
    ]);
    const trainingIds = items.map(({ trainingId }) => trainingId);
    const completedEvaluationIds =
      principal.role === 'LEARNER'
        ? new Set(
            (
              await EvaluationAttemptModel.find({
                learnerId: principal.userId,
                evaluationId: { $in: items.map(({ _id }) => _id) },
                status: 'PASSED',
              })
                .select('evaluationId')
                .exec()
            ).map(({ evaluationId }) => String(evaluationId)),
          )
        : new Set<string>();
    const [trainings, questionCounts] = await Promise.all([
      TrainingModel.find({ _id: { $in: trainingIds } })
        .select('title certifyingEvaluationId')
        .exec(),
      EvaluationQuestionModel.aggregate<{
        _id: mongoose.Types.ObjectId;
        count: number;
      }>([
        { $match: { evaluationId: { $in: items.map(({ _id }) => _id) } } },
        { $group: { _id: '$evaluationId', count: { $sum: 1 } } },
      ]),
    ]);
    const trainingById = new Map(
      trainings.map((training) => [String(training._id), training]),
    );
    const countById = new Map(
      questionCounts.map(({ _id, count }) => [String(_id), count]),
    );
    return {
      items: items.map((evaluation) =>
        this.#summary(
          evaluation,
          trainingById.get(String(evaluation.trainingId)),
          countById.get(String(evaluation._id)) ?? 0,
          completedEvaluationIds.has(String(evaluation._id)),
        ),
      ),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async detail(principal: AuthenticatedPrincipal, evaluationId: string) {
    ready(principal);
    const evaluation = await this.#evaluation(evaluationId);
    const training = await TrainingModel.findById(evaluation.trainingId).exec();
    if (training === null)
      throw new Error('Evaluation Training reference is inconsistent.');
    const staffCanRead =
      principal.role === 'ADMIN' ||
      (principal.role === 'TRAINER' &&
        String(evaluation.ownerTrainerId) === principal.userId);
    if (!staffCanRead) {
      if (
        principal.role !== 'LEARNER' ||
        !['PUBLISHED', 'ARCHIVED'].includes(evaluation.status)
      )
        throw new AppError(
          403,
          'EVALUATION_ACCESS_FORBIDDEN',
          'You cannot access this Evaluation.',
        );
      if (
        (await EnrollmentModel.exists({
          learnerId: principal.userId,
          trainingId: evaluation.trainingId,
        })) === null
      )
        throw new AppError(
          403,
          'TRAINING_ENROLLMENT_REQUIRED',
          'A paid Enrollment in this Training is required.',
        );
    }
    const questions = await EvaluationQuestionModel.find({
      evaluationId: evaluation._id,
    })
      .sort({ order: 1, _id: 1 })
      .exec();
    if (staffCanRead)
      return {
        ...this.#summary(evaluation, training, questions.length),
        questions: questions.map((question) => this.#question(question, true)),
      };
    const attempts = await EvaluationAttemptModel.find({
      evaluationId: evaluation._id,
      learnerId: principal.userId,
    })
      .sort({ attemptNumber: 1 })
      .exec();
    for (const attempt of attempts) await this.#expireIfNeeded(attempt);
    const completed = attempts.some(({ status }) => status === 'PASSED');
    return {
      ...this.#summary(evaluation, training, questions.length, completed),
      questions: questions.map((question) => this.#question(question, false)),
      attempts: await Promise.all(
        attempts.map((attempt) => this.#attemptView(attempt)),
      ),
    };
  }

  async create(
    principal: AuthenticatedPrincipal,
    input: CreateEvaluationInput,
  ) {
    const training = await this.#ownedTraining(principal, input.trainingId);
    const evaluation = await EvaluationModel.create({
      trainingId: input.trainingId,
      title: input.title,
      instructions: input.instructions,
      passPercentage: input.passPercentage,
      maxAttempts: input.maxAttempts,
      ...(input.durationMinutes === undefined
        ? {}
        : { durationMinutes: input.durationMinutes }),
      ownerTrainerId: training.ownerTrainerId,
      status: 'DRAFT',
    });
    return this.detail(principal, String(evaluation._id));
  }

  async update(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
    input: UpdateEvaluationInput,
  ) {
    const evaluation = await this.#ownedDraft(principal, evaluationId);
    const update = { ...input } as Record<string, unknown>;
    const unset: Record<string, 1> = {};
    if (input.durationMinutes === null) {
      delete update.durationMinutes;
      unset.durationMinutes = 1;
    }
    await EvaluationModel.updateOne(
      { _id: evaluation._id, status: 'DRAFT' },
      {
        ...(Object.keys(update).length > 0 ? { $set: update } : {}),
        ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      },
      { runValidators: true },
    );
    return this.detail(principal, evaluationId);
  }

  async remove(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
  ): Promise<void> {
    const evaluation = await this.#ownedDraft(principal, evaluationId);
    await mongoose.connection.transaction(async (session) => {
      const deleted = await EvaluationModel.deleteOne({
        _id: evaluation._id,
        status: 'DRAFT',
      }).session(session);
      if (deleted.deletedCount !== 1)
        throw new AppError(
          409,
          'EVALUATION_CHANGED',
          'The Evaluation changed before deletion.',
        );
      await EvaluationQuestionModel.deleteMany({
        evaluationId: evaluation._id,
      }).session(session);
    });
  }

  async addQuestion(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
    input: QuestionInput,
  ) {
    const evaluation = await this.#ownedDraft(principal, evaluationId);
    try {
      const question = await EvaluationQuestionModel.create({
        type: input.type,
        prompt: input.prompt,
        options: input.options,
        correctOptionIds: input.correctOptionIds,
        points: input.points,
        order: input.order,
        ...(input.explanation === undefined
          ? {}
          : { explanation: input.explanation }),
        evaluationId: evaluation._id,
        trainingId: evaluation.trainingId,
      });
      return this.#question(question, true);
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new AppError(
          409,
          'QUESTION_ORDER_CONFLICT',
          'A question already uses this order.',
        );
      throw error;
    }
  }

  async updateQuestion(
    principal: AuthenticatedPrincipal,
    questionId: string,
    input: UpdateQuestionInput,
  ) {
    const question = await EvaluationQuestionModel.findById(questionId).exec();
    if (question === null)
      throw new AppError(
        404,
        'QUESTION_NOT_FOUND',
        'The question does not exist.',
      );
    await this.#ownedDraft(principal, String(question.evaluationId));
    const merged = questionInputSchema.parse({
      type: input.type ?? question.type,
      prompt: input.prompt ?? question.prompt,
      options:
        input.options ?? question.options.map(({ id, text }) => ({ id, text })),
      correctOptionIds: input.correctOptionIds ?? question.correctOptionIds,
      explanation: input.explanation ?? question.explanation,
      points: input.points ?? question.points,
      order: input.order ?? question.order,
    });
    try {
      question.set(merged);
      await question.save();
      return this.#question(question, true);
    } catch (error) {
      if (isDuplicateKeyError(error))
        throw new AppError(
          409,
          'QUESTION_ORDER_CONFLICT',
          'A question already uses this order.',
        );
      throw error;
    }
  }

  async removeQuestion(
    principal: AuthenticatedPrincipal,
    questionId: string,
  ): Promise<void> {
    const question = await EvaluationQuestionModel.findById(questionId).exec();
    if (question === null)
      throw new AppError(
        404,
        'QUESTION_NOT_FOUND',
        'The question does not exist.',
      );
    await this.#ownedDraft(principal, String(question.evaluationId));
    await question.deleteOne();
  }

  async publish(principal: AuthenticatedPrincipal, evaluationId: string) {
    const evaluation = await this.#ownedDraft(principal, evaluationId);
    const questions = await EvaluationQuestionModel.find({
      evaluationId: evaluation._id,
    }).exec();
    if (
      questions.length === 0 ||
      questions.reduce((sum, question) => sum + question.points, 0) <= 0
    )
      throw new AppError(
        409,
        'EVALUATION_NOT_PUBLISHABLE',
        'At least one valid question and a positive point total are required.',
      );
    evaluation.status = 'PUBLISHED';
    evaluation.publishedAt = new Date();
    await evaluation.save();
    return this.detail(principal, evaluationId);
  }

  async archive(principal: AuthenticatedPrincipal, evaluationId: string) {
    ready(principal);
    const evaluation = await this.#evaluation(evaluationId);
    const owner =
      principal.role === 'TRAINER' &&
      String(evaluation.ownerTrainerId) === principal.userId;
    if (principal.role !== 'ADMIN' && !owner)
      throw new AppError(
        403,
        'EVALUATION_ARCHIVE_FORBIDDEN',
        'Only the owner or an Admin can archive this Evaluation.',
      );
    if (!['DRAFT', 'PUBLISHED'].includes(evaluation.status))
      throw new AppError(
        409,
        'EVALUATION_NOT_PUBLISHED',
        'Only a draft or published Evaluation can be archived.',
      );
    if (
      (await TrainingModel.exists({
        _id: evaluation.trainingId,
        certifyingEvaluationId: evaluation._id,
      })) !== null
    )
      throw new AppError(
        409,
        'CERTIFYING_EVALUATION_CANNOT_BE_ARCHIVED',
        'Remove the certifying designation before archiving this Evaluation.',
      );
    evaluation.status = 'ARCHIVED';
    evaluation.archivedAt = new Date();
    await evaluation.save();
    return this.detail(principal, evaluationId);
  }

  async designate(
    principal: AuthenticatedPrincipal,
    trainingId: string,
    evaluationId: string | null,
  ) {
    const training = await this.#ownedTraining(principal, trainingId);
    if (evaluationId === null) {
      await TrainingModel.updateOne(
        { _id: training._id },
        { $unset: { certifyingEvaluationId: 1 } },
      );
      return { trainingId, certifyingEvaluationId: null };
    } else {
      const evaluation = await this.#evaluation(evaluationId);
      if (
        String(evaluation.trainingId) !== trainingId ||
        evaluation.status !== 'PUBLISHED'
      )
        throw new AppError(
          422,
          'PUBLISHED_TRAINING_EVALUATION_REQUIRED',
          'The certifying Evaluation must be published and belong to this Training.',
        );
      training.certifyingEvaluationId = evaluation._id;
    }
    await training.save();
    return {
      trainingId,
      certifyingEvaluationId:
        training.certifyingEvaluationId === undefined
          ? null
          : String(training.certifyingEvaluationId),
    };
  }

  async startAttempt(
    principal: AuthenticatedPrincipal,
    evaluationId: string,
    enrollmentId: string,
  ) {
    ready(principal);
    if (principal.role !== 'LEARNER')
      throw new AppError(
        403,
        'LEARNER_ACCESS_REQUIRED',
        'Only a Learner can start an Attempt.',
      );
    const [evaluation, enrollment] = await Promise.all([
      this.#evaluation(evaluationId),
      EnrollmentModel.findOne({
        _id: enrollmentId,
        learnerId: principal.userId,
      }).exec(),
    ]);
    if (evaluation.status !== 'PUBLISHED')
      throw new AppError(
        409,
        'EVALUATION_NOT_AVAILABLE',
        'Only a published Evaluation accepts new Attempts.',
      );
    if (
      enrollment === null ||
      String(enrollment.trainingId) !== String(evaluation.trainingId)
    )
      throw new AppError(
        403,
        'TRAINING_ENROLLMENT_REQUIRED',
        'A paid Enrollment in this Training is required.',
      );
    const active = await EvaluationAttemptModel.findOne({
      evaluationId: evaluation._id,
      enrollmentId: enrollment._id,
      status: 'IN_PROGRESS',
    }).exec();
    if (active !== null) {
      if (!(await this.#expireIfNeeded(active)))
        return this.#attemptView(active);
    }
    const consumed = await EvaluationAttemptModel.countDocuments({
      evaluationId: evaluation._id,
      enrollmentId: enrollment._id,
      status: { $in: ['PASSED', 'FAILED'] },
    });
    const passed = await EvaluationAttemptModel.exists({
      evaluationId: evaluation._id,
      enrollmentId: enrollment._id,
      status: 'PASSED',
    });
    if (passed !== null)
      throw new AppError(
        409,
        'EVALUATION_ALREADY_COMPLETED',
        'This Evaluation has already been completed successfully.',
      );
    if (consumed >= evaluation.maxAttempts)
      throw new AppError(
        409,
        'ATTEMPT_LIMIT_REACHED',
        'No Evaluation attempts remain.',
      );
    const questions = await EvaluationQuestionModel.find({
      evaluationId: evaluation._id,
    })
      .sort({ order: 1 })
      .exec();
    if (questions.length === 0)
      throw new AppError(
        409,
        'EVALUATION_HAS_NO_QUESTIONS',
        'This Evaluation has no questions.',
      );
    const now = new Date();
    let attemptId = '';
    await mongoose.connection.transaction(async (session) => {
      const [attempt] = await EvaluationAttemptModel.create(
        [
          {
            evaluationId: evaluation._id,
            trainingId: evaluation.trainingId,
            enrollmentId: enrollment._id,
            learnerId: enrollment.learnerId,
            attemptNumber: consumed + 1,
            status: 'IN_PROGRESS',
            startedAt: now,
            ...(evaluation.durationMinutes === undefined
              ? {}
              : {
                  expiresAt: new Date(
                    now.getTime() + evaluation.durationMinutes * 60_000,
                  ),
                }),
            settings: {
              passPercentage: evaluation.passPercentage,
              maxAttempts: evaluation.maxAttempts,
              ...(evaluation.durationMinutes === undefined
                ? {}
                : { durationMinutes: evaluation.durationMinutes }),
            },
          },
        ],
        { session },
      );
      if (attempt === undefined) throw new Error('Attempt creation failed.');
      attemptId = String(attempt._id);
      await EvaluationAnswerModel.insertMany(
        questions.map((question) => ({
          attemptId: attempt._id,
          questionId: question._id,
          selectedOptionIds: [],
          snapshot: {
            order: question.order,
            points: question.points,
            prompt: question.prompt,
            ...(question.explanation === undefined
              ? {}
              : { explanation: question.explanation }),
            type: question.type,
            options: question.options.map(({ id, text }) => ({ id, text })),
            correctOptionIds: [...question.correctOptionIds],
          },
        })),
        { session },
      );
    });
    const attempt = await EvaluationAttemptModel.findById(attemptId).exec();
    if (attempt === null) throw new Error('Created Attempt is missing.');
    return this.#attemptView(attempt);
  }

  async getAttempt(principal: AuthenticatedPrincipal, attemptId: string) {
    const attempt = await this.#learnerAttempt(principal, attemptId);
    await this.#expireIfNeeded(attempt);
    return this.#attemptView(attempt);
  }
  async saveAnswer(
    principal: AuthenticatedPrincipal,
    attemptId: string,
    input: SaveAnswerInput,
  ) {
    const attempt = await this.#learnerAttempt(principal, attemptId);
    if (await this.#expireIfNeeded(attempt))
      throw new AppError(
        409,
        'ATTEMPT_EXPIRED',
        'The Attempt duration has expired and the result is final.',
      );
    if (attempt.status !== 'IN_PROGRESS')
      throw new AppError(
        409,
        'ATTEMPT_IMMUTABLE',
        'A completed Attempt cannot be changed.',
      );
    const answer = await EvaluationAnswerModel.findOne({
      attemptId: attempt._id,
      questionId: input.questionId,
    }).exec();
    if (answer === null)
      throw new AppError(
        422,
        'ATTEMPT_QUESTION_REQUIRED',
        'The question does not belong to this Attempt.',
      );
    const optionIds = answer.snapshot.options.map(({ id }) => id);
    if (input.selectedOptionIds.some((id) => !optionIds.includes(id)))
      throw new AppError(
        422,
        'INVALID_ANSWER_OPTION',
        'Every selected answer must reference a question option.',
      );
    if (
      answer.snapshot.type !== 'MULTIPLE_CHOICE' &&
      input.selectedOptionIds.length > 1
    )
      throw new AppError(
        422,
        'TOO_MANY_ANSWERS',
        'This question accepts at most one answer.',
      );
    answer.selectedOptionIds = input.selectedOptionIds;
    await answer.save();
    return this.#attemptView(attempt);
  }
  async submit(principal: AuthenticatedPrincipal, attemptId: string) {
    const attempt = await this.#learnerAttempt(principal, attemptId);
    if (attempt.status !== 'IN_PROGRESS') return this.#attemptView(attempt);
    await this.#grade(attempt, new Date());
    return this.#attemptView(attempt);
  }

  async results(principal: AuthenticatedPrincipal, evaluationId: string) {
    ready(principal);
    const evaluation = await this.#evaluation(evaluationId);
    if (
      principal.role !== 'ADMIN' &&
      !(
        principal.role === 'TRAINER' &&
        String(evaluation.ownerTrainerId) === principal.userId
      )
    )
      throw new AppError(
        403,
        'EVALUATION_RESULTS_FORBIDDEN',
        'Only the owner or an Admin can view these results.',
      );
    const attempts = await EvaluationAttemptModel.find({
      evaluationId: evaluation._id,
    })
      .sort({ submittedAt: -1, createdAt: -1 })
      .exec();
    for (const attempt of attempts) await this.#expireIfNeeded(attempt);
    const learners = await UserModel.find({
      _id: { $in: attempts.map(({ learnerId }) => learnerId) },
    })
      .select('email profile')
      .exec();
    const learnerById = new Map(
      learners.map((learner) => [String(learner._id), learner]),
    );
    const completed = attempts.filter(({ status }) => status !== 'IN_PROGRESS');
    return {
      evaluationId,
      totalAttempts: completed.length,
      passedAttempts: completed.filter(({ status }) => status === 'PASSED')
        .length,
      items: completed.map((attempt) => {
        const learner = learnerById.get(String(attempt.learnerId));
        return {
          id: String(attempt._id),
          attemptNumber: attempt.attemptNumber,
          status: attempt.status,
          scorePoints: attempt.scorePoints,
          totalPoints: attempt.totalPoints,
          scorePercentage: attempt.scorePercentage,
          submittedAt: attempt.submittedAt?.toISOString(),
          learner: {
            id: String(attempt.learnerId),
            email: learner?.email ?? '',
            ...(learner?.profile ?? {}),
          },
        };
      }),
    };
  }

  async #grade(
    attempt: HydratedDocument<EvaluationAttempt>,
    submittedAt: Date,
  ): Promise<void> {
    const answers = await EvaluationAnswerModel.find({
      attemptId: attempt._id,
    }).exec();
    let score = 0;
    let total = 0;
    for (const answer of answers) {
      total += answer.snapshot.points;
      const correct = sameSet(
        answer.selectedOptionIds,
        answer.snapshot.correctOptionIds,
      );
      answer.awardedPoints = correct ? answer.snapshot.points : 0;
      score += answer.awardedPoints;
      await answer.save();
    }
    const percentage =
      total === 0 ? 0 : Math.round((score / total) * 10_000) / 100;
    attempt.scorePoints = score;
    attempt.totalPoints = total;
    attempt.scorePercentage = percentage;
    attempt.status =
      percentage >= attempt.settings.passPercentage ? 'PASSED' : 'FAILED';
    attempt.submittedAt = submittedAt;
    await attempt.save();
  }
  async #expireIfNeeded(
    attempt: HydratedDocument<EvaluationAttempt>,
  ): Promise<boolean> {
    if (
      attempt.status === 'IN_PROGRESS' &&
      attempt.expiresAt !== undefined &&
      attempt.expiresAt.getTime() <= Date.now()
    ) {
      await this.#grade(attempt, attempt.expiresAt);
      return true;
    }
    return false;
  }
  async #attemptView(attempt: HydratedDocument<EvaluationAttempt>) {
    const answers = await EvaluationAnswerModel.find({ attemptId: attempt._id })
      .sort({ 'snapshot.order': 1 })
      .exec();
    const reveal =
      attempt.status !== 'IN_PROGRESS' &&
      (attempt.status === 'PASSED' ||
        attempt.attemptNumber >= attempt.settings.maxAttempts);
    return {
      id: String(attempt._id),
      evaluationId: String(attempt.evaluationId),
      enrollmentId: String(attempt.enrollmentId),
      attemptNumber: attempt.attemptNumber,
      status: attempt.status,
      startedAt: attempt.startedAt.toISOString(),
      ...(attempt.expiresAt === undefined
        ? {}
        : {
            expiresAt: attempt.expiresAt.toISOString(),
            remainingSeconds: Math.max(
              0,
              Math.ceil((attempt.expiresAt.getTime() - Date.now()) / 1000),
            ),
          }),
      ...(attempt.submittedAt === undefined
        ? {}
        : {
            submittedAt: attempt.submittedAt.toISOString(),
            scorePoints: attempt.scorePoints,
            totalPoints: attempt.totalPoints,
            scorePercentage: attempt.scorePercentage,
          }),
      answersRevealed: reveal,
      answers: answers.map((answer) => ({
        questionId: String(answer.questionId),
        selectedOptionIds: answer.selectedOptionIds,
        ...(answer.awardedPoints === undefined
          ? {}
          : { awardedPoints: answer.awardedPoints }),
        question: {
          order: answer.snapshot.order,
          points: answer.snapshot.points,
          prompt: answer.snapshot.prompt,
          type: answer.snapshot.type,
          options: answer.snapshot.options.map(({ id, text }) => ({
            id,
            text,
          })),
          ...(reveal
            ? {
                correctOptionIds: answer.snapshot.correctOptionIds,
                ...(answer.snapshot.explanation === undefined
                  ? {}
                  : { explanation: answer.snapshot.explanation }),
              }
            : {}),
        },
      })),
    };
  }
  #summary(
    evaluation: HydratedDocument<Evaluation>,
    training:
      | { _id: unknown; title: string; certifyingEvaluationId?: unknown }
      | undefined,
    questionCount: number,
    completed = false,
  ) {
    return {
      id: String(evaluation._id),
      training: {
        id: String(evaluation.trainingId),
        title: training?.title ?? '',
      },
      ownerTrainerId: String(evaluation.ownerTrainerId),
      title: evaluation.title,
      instructions: evaluation.instructions,
      status: evaluation.status,
      passPercentage: evaluation.passPercentage,
      maxAttempts: evaluation.maxAttempts,
      ...(evaluation.durationMinutes === undefined
        ? {}
        : { durationMinutes: evaluation.durationMinutes }),
      questionCount,
      completed,
      isCertifying:
        training?.certifyingEvaluationId !== undefined &&
        String(training.certifyingEvaluationId) === String(evaluation._id),
      ...(evaluation.aiGeneration === undefined
        ? {}
        : { aiGeneration: evaluation.aiGeneration }),
      createdAt: evaluation.createdAt.toISOString(),
      updatedAt: evaluation.updatedAt.toISOString(),
    };
  }
  #question(
    question: {
      _id: unknown;
      order: number;
      points: number;
      prompt: string;
      explanation?: string;
      type: string;
      options: Array<{ id: string; text: string }>;
      correctOptionIds: string[];
    },
    includeAnswer: boolean,
  ) {
    return {
      id: String(question._id),
      order: question.order,
      points: question.points,
      prompt: question.prompt,
      type: question.type,
      options: question.options.map(({ id, text }) => ({ id, text })),
      ...(includeAnswer
        ? {
            correctOptionIds: question.correctOptionIds,
            ...(question.explanation === undefined
              ? {}
              : { explanation: question.explanation }),
          }
        : {}),
    };
  }
  async #evaluation(id: string) {
    const evaluation = await EvaluationModel.findById(id).exec();
    if (evaluation === null)
      throw new AppError(
        404,
        'EVALUATION_NOT_FOUND',
        'The Evaluation does not exist.',
      );
    return evaluation;
  }
  async #ownedTraining(principal: AuthenticatedPrincipal, id: string) {
    ready(principal);
    if (principal.role !== 'TRAINER')
      throw new AppError(
        403,
        'EVALUATION_AUTHORING_FORBIDDEN',
        'Only the owner Trainer can author Evaluations.',
      );
    const training = await TrainingModel.findById(id).exec();
    if (training === null)
      throw new AppError(
        404,
        'TRAINING_NOT_FOUND',
        'The Training does not exist.',
      );
    if (String(training.ownerTrainerId) !== principal.userId)
      throw new AppError(
        403,
        'TRAINING_OWNERSHIP_REQUIRED',
        'Only the Training owner can author its Evaluations.',
      );
    return training;
  }
  async #ownedDraft(principal: AuthenticatedPrincipal, id: string) {
    const evaluation = await this.#evaluation(id);
    await this.#ownedTraining(principal, String(evaluation.trainingId));
    if (evaluation.status !== 'DRAFT')
      throw new AppError(
        409,
        'DRAFT_EVALUATION_REQUIRED',
        'Only a draft Evaluation can be modified.',
      );
    return evaluation;
  }
  async #learnerAttempt(principal: AuthenticatedPrincipal, id: string) {
    ready(principal);
    if (principal.role !== 'LEARNER')
      throw new AppError(
        403,
        'LEARNER_ACCESS_REQUIRED',
        'Only a Learner can access an Attempt.',
      );
    const attempt = await EvaluationAttemptModel.findOne({
      _id: id,
      learnerId: principal.userId,
    }).exec();
    if (attempt === null)
      throw new AppError(
        404,
        'ATTEMPT_NOT_FOUND',
        'The Attempt does not exist.',
      );
    return attempt;
  }
}

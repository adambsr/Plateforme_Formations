import { Types, type HydratedDocument, type QueryFilter } from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  toTunisCalendarDate,
  tunisDateRange,
} from '../../../shared/time/tunis-date-range.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type {
  CreateTrainingCost,
  TrainerCostList,
  TrainerCostPath,
  TrainerCostWrite,
  TrainingCostList,
  UpdateTrainingCost,
} from '../dto/cost.dto.js';
import {
  TrainerCostModel,
  type TrainerCost,
} from '../models/trainer-cost.model.js';
import {
  TrainingCostModel,
  type TrainingCost,
} from '../models/training-cost.model.js';

function requireAdmin(principal: AuthenticatedPrincipal): void {
  if (principal.mustChangePassword) {
    throw new AppError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'The temporary password must be changed before continuing.',
    );
  }
  if (principal.role !== 'ADMIN') {
    throw new AppError(
      403,
      'ADMIN_COST_ACCESS_REQUIRED',
      'Only the Admin can manage costs and profitability.',
    );
  }
}

export class CostService {
  async listTrainerCosts(
    principal: AuthenticatedPrincipal,
    input: TrainerCostList,
  ) {
    requireAdmin(principal);
    const filter: QueryFilter<TrainerCost> = {
      ...(input.trainerId === undefined ? {} : { trainerId: input.trainerId }),
      ...(input.year === undefined ? {} : { year: input.year }),
      ...(input.month === undefined ? {} : { month: input.month }),
    };
    const [costs, total] = await Promise.all([
      TrainerCostModel.find(filter)
        .sort({ year: -1, month: -1, trainerId: 1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      TrainerCostModel.countDocuments(filter),
    ]);
    const trainers = await UserModel.find({
      _id: { $in: costs.map(({ trainerId }) => trainerId) },
    }).exec();
    const byId = new Map(
      trainers.map((trainer) => [String(trainer._id), trainer]),
    );
    return {
      items: costs.map((cost) => {
        const trainer = byId.get(String(cost.trainerId));
        if (trainer === undefined) {
          throw new Error('TrainerCost Trainer reference is inconsistent.');
        }
        return this.#trainerCostView(cost, trainer);
      }),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async upsertTrainerCost(
    principal: AuthenticatedPrincipal,
    path: TrainerCostPath,
    input: TrainerCostWrite,
  ) {
    requireAdmin(principal);
    const trainer = await UserModel.findOne({
      _id: path.trainerId,
      role: 'TRAINER',
    }).exec();
    if (trainer === null) {
      throw new AppError(
        404,
        'TRAINER_NOT_FOUND',
        'The Trainer does not exist.',
      );
    }
    const cost = await TrainerCostModel.findOneAndUpdate(
      {
        trainerId: trainer._id,
        year: path.year,
        month: path.month,
      },
      {
        $set: {
          amountMinor: input.amountMinor,
          currency: 'TND',
          ...(input.note === undefined ? {} : { note: input.note }),
        },
        ...(input.note === undefined ? { $unset: { note: 1 } } : {}),
        $setOnInsert: {
          trainerId: trainer._id,
          year: path.year,
          month: path.month,
        },
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    ).exec();
    if (cost === null) {
      throw new Error('TrainerCost upsert did not return a record.');
    }
    return this.#trainerCostView(cost, trainer);
  }

  async listTrainingCosts(
    principal: AuthenticatedPrincipal,
    input: TrainingCostList,
  ) {
    requireAdmin(principal);
    const range =
      input.from === undefined || input.to === undefined
        ? undefined
        : tunisDateRange(input.from, input.to);
    const filter: QueryFilter<TrainingCost> = {
      ...(input.trainingId === undefined
        ? {}
        : { trainingId: input.trainingId }),
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      ...(range === undefined
        ? {}
        : {
            incurredOn: {
              $gte: range.startAt,
              $lt: range.endAtExclusive,
            },
          }),
    };
    const [costs, total] = await Promise.all([
      TrainingCostModel.find(filter)
        .sort({ incurredOn: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      TrainingCostModel.countDocuments(filter),
    ]);
    return {
      items: await this.#trainingCostViews(costs),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async createTrainingCost(
    principal: AuthenticatedPrincipal,
    input: CreateTrainingCost,
  ) {
    requireAdmin(principal);
    await this.#assertTarget(input.trainingId, input.sessionId);
    const cost = await TrainingCostModel.create({
      trainingId: input.trainingId,
      ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
      incurredOn: tunisDateRange(input.date, input.date).startAt,
      amountMinor: input.amountMinor,
      currency: 'TND',
      label: input.label,
    });
    return (await this.#trainingCostViews([cost]))[0];
  }

  async updateTrainingCost(
    principal: AuthenticatedPrincipal,
    costId: string,
    input: UpdateTrainingCost,
  ) {
    requireAdmin(principal);
    const cost = await TrainingCostModel.findById(costId).exec();
    if (cost === null) throw this.#trainingCostNotFound();
    const trainingId = input.trainingId ?? String(cost.trainingId);
    const sessionId =
      input.sessionId === null
        ? undefined
        : (input.sessionId ??
          (cost.sessionId === undefined ? undefined : String(cost.sessionId)));
    await this.#assertTarget(trainingId, sessionId);
    cost.trainingId = new Types.ObjectId(trainingId);
    if (sessionId === undefined) {
      cost.set('sessionId', undefined);
    } else {
      cost.sessionId = new Types.ObjectId(sessionId);
    }
    if (input.date !== undefined) {
      cost.incurredOn = tunisDateRange(input.date, input.date).startAt;
    }
    if (input.amountMinor !== undefined) cost.amountMinor = input.amountMinor;
    if (input.label !== undefined) cost.label = input.label;
    await cost.save();
    return (await this.#trainingCostViews([cost]))[0];
  }

  async deleteTrainingCost(principal: AuthenticatedPrincipal, costId: string) {
    requireAdmin(principal);
    const result = await TrainingCostModel.deleteOne({ _id: costId });
    if (result.deletedCount === 0) throw this.#trainingCostNotFound();
  }

  async #assertTarget(trainingId: string, sessionId: string | undefined) {
    const training = await TrainingModel.findById(trainingId).exec();
    if (training === null) {
      throw new AppError(
        404,
        'TRAINING_NOT_FOUND',
        'The Training does not exist.',
      );
    }
    if (sessionId !== undefined) {
      const session = await TrainingSessionModel.findOne({
        _id: sessionId,
        trainingId: training._id,
      }).exec();
      if (session === null) {
        throw new AppError(
          422,
          'TRAINING_SESSION_MISMATCH',
          'The optional Session must belong to the selected Training.',
        );
      }
    }
  }

  #trainerCostView(
    cost: HydratedDocument<TrainerCost>,
    trainer: Awaited<ReturnType<typeof UserModel.findOne>> extends never
      ? never
      : NonNullable<Awaited<ReturnType<typeof UserModel.findOne>>>,
  ) {
    return {
      id: String(cost._id),
      trainer: {
        id: String(trainer._id),
        email: trainer.email,
        ...trainer.profile,
      },
      year: cost.year,
      month: cost.month,
      amountMinor: cost.amountMinor,
      currency: cost.currency,
      ...(cost.note === undefined ? {} : { note: cost.note }),
      createdAt: cost.createdAt.toISOString(),
      updatedAt: cost.updatedAt.toISOString(),
    };
  }

  async #trainingCostViews(costs: Array<HydratedDocument<TrainingCost>>) {
    const [trainings, sessions] = await Promise.all([
      TrainingModel.find({
        _id: { $in: costs.map(({ trainingId }) => trainingId) },
      }).exec(),
      TrainingSessionModel.find({
        _id: {
          $in: costs.flatMap(({ sessionId }) =>
            sessionId === undefined ? [] : [sessionId],
          ),
        },
      }).exec(),
    ]);
    const trainingById = new Map(
      trainings.map((training) => [String(training._id), training]),
    );
    const sessionById = new Map(
      sessions.map((session) => [String(session._id), session]),
    );
    return costs.map((cost) => {
      const training = trainingById.get(String(cost.trainingId));
      if (training === undefined) {
        throw new Error('TrainingCost Training reference is inconsistent.');
      }
      const session =
        cost.sessionId === undefined
          ? undefined
          : sessionById.get(String(cost.sessionId));
      return {
        id: String(cost._id),
        training: { id: String(training._id), title: training.title },
        ...(session === undefined
          ? {}
          : { session: { id: String(session._id), title: session.title } }),
        date: toTunisCalendarDate(cost.incurredOn),
        amountMinor: cost.amountMinor,
        currency: cost.currency,
        label: cost.label,
        createdAt: cost.createdAt.toISOString(),
        updatedAt: cost.updatedAt.toISOString(),
      };
    });
  }

  #trainingCostNotFound() {
    return new AppError(
      404,
      'TRAINING_COST_NOT_FOUND',
      'The Training cost does not exist.',
    );
  }
}

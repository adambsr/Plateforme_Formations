import { Types } from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  tunisDateRange,
  type TunisDateRange,
} from '../../../shared/time/tunis-date-range.js';
import { AttendanceModel } from '../../attendance/models/attendance.model.js';
import { TrainingCostModel } from '../../costs/models/training-cost.model.js';
import { TrainerCostModel } from '../../costs/models/trainer-cost.model.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { EvaluationAttemptModel } from '../../evaluations/models/evaluation-attempt.model.js';
import { FeedbackModel } from '../../feedback/models/feedback.model.js';
import { PaymentModel } from '../../payments/models/payment.model.js';
import { LessonProgressModel } from '../../progress/models/lesson-progress.model.js';
import { SessionScheduleModel } from '../../sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type { DashboardRangeInput } from '../dto/dashboard.dto.js';

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
      'ADMIN_DASHBOARD_REQUIRED',
      'Only the Admin can view centre statistics and profitability.',
    );
  }
}

function period(range: TunisDateRange) {
  return {
    from: range.from,
    to: range.to,
    timeZone: 'Africa/Tunis' as const,
  };
}

function percentage(numerator: number, denominator: number) {
  return denominator === 0
    ? null
    : Number(((numerator / denominator) * 100).toFixed(2));
}

function distribution() {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

export class DashboardService {
  async overview(
    principal: AuthenticatedPrincipal,
    input: DashboardRangeInput,
  ) {
    requireAdmin(principal);
    const range = tunisDateRange(input.from, input.to);
    const createdAt = { $gte: range.startAt, $lt: range.endAtExclusive };
    const [trainings, sessions, learners, trainers, enrollments] =
      await Promise.all([
        TrainingModel.aggregate<{ count: number }>([
          { $match: { createdAt } },
          { $count: 'count' },
        ]),
        TrainingSessionModel.aggregate<{ count: number }>([
          { $match: { createdAt } },
          { $count: 'count' },
        ]),
        UserModel.aggregate<{ count: number }>([
          { $match: { role: 'LEARNER', createdAt } },
          { $count: 'count' },
        ]),
        UserModel.aggregate<{ count: number }>([
          { $match: { role: 'TRAINER', createdAt } },
          { $count: 'count' },
        ]),
        EnrollmentModel.aggregate<{ count: number }>([
          { $match: { createdAt } },
          { $count: 'count' },
        ]),
      ]);
    return {
      period: period(range),
      counts: {
        trainings: trainings[0]?.count ?? 0,
        sessions: sessions[0]?.count ?? 0,
        learners: learners[0]?.count ?? 0,
        trainers: trainers[0]?.count ?? 0,
        enrollments: enrollments[0]?.count ?? 0,
      },
    };
  }

  async participation(
    principal: AuthenticatedPrincipal,
    input: DashboardRangeInput,
  ) {
    requireAdmin(principal);
    const range = tunisDateRange(input.from, input.to);
    const rows = await SessionScheduleModel.aggregate<{
      trainingId: string;
      trainingTitle: string;
      expected: number;
      present: number;
      recorded: number;
    }>([
      {
        $match: {
          startAt: { $gte: range.startAt, $lt: range.endAtExclusive },
        },
      },
      {
        $lookup: {
          from: 'enrollments',
          localField: 'sessionId',
          foreignField: 'sessionId',
          as: 'enrollments',
        },
      },
      {
        $lookup: {
          from: AttendanceModel.collection.name,
          let: { scheduleId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$scheduleId', '$$scheduleId'] },
              },
            },
          ],
          as: 'attendance',
        },
      },
      {
        $group: {
          _id: '$trainingId',
          expected: { $sum: { $size: '$enrollments' } },
          recorded: { $sum: { $size: '$attendance' } },
          present: {
            $sum: {
              $size: {
                $filter: {
                  input: '$attendance',
                  as: 'entry',
                  cond: { $eq: ['$$entry.status', 'PRESENT'] },
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: TrainingModel.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'training',
        },
      },
      {
        $project: {
          _id: 0,
          trainingId: { $toString: '$_id' },
          trainingTitle: {
            $ifNull: [{ $arrayElemAt: ['$training.title', 0] }, 'Archived'],
          },
          expected: 1,
          recorded: 1,
          present: 1,
        },
      },
      { $sort: { trainingTitle: 1 } },
    ]);
    const expected = rows.reduce((sum, row) => sum + row.expected, 0);
    const recorded = rows.reduce((sum, row) => sum + row.recorded, 0);
    const present = rows.reduce((sum, row) => sum + row.present, 0);
    return {
      period: period(range),
      overall: {
        expected,
        recorded,
        present,
        participationPercent: percentage(present, expected),
      },
      byTraining: rows.map((row) => ({
        training: { id: row.trainingId, title: row.trainingTitle },
        expected: row.expected,
        recorded: row.recorded,
        present: row.present,
        participationPercent: percentage(row.present, row.expected),
      })),
    };
  }

  async progress(
    principal: AuthenticatedPrincipal,
    input: DashboardRangeInput,
  ) {
    requireAdmin(principal);
    const range = tunisDateRange(input.from, input.to);
    const [progressRows, evaluations] = await Promise.all([
      EnrollmentModel.aggregate<{
        enrollmentCount: number;
        completedEnrollments: number;
        averagePercentage: number | null;
      }>([
        {
          $match: {
            sessionId: null,
            createdAt: { $gte: range.startAt, $lt: range.endAtExclusive },
          },
        },
        {
          $lookup: {
            from: TrainingModel.collection.name,
            localField: 'trainingId',
            foreignField: '_id',
            as: 'training',
          },
        },
        {
          $match: {
            'training.type': 'SELF_PACED_ONLINE',
          },
        },
        {
          $lookup: {
            from: 'certificates',
            localField: '_id',
            foreignField: 'enrollmentId',
            as: 'certificate',
          },
        },
        {
          $lookup: {
            from: 'training_modules',
            let: { trainingId: '$trainingId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$trainingId', '$$trainingId'] },
                  isArchived: false,
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'modules',
          },
        },
        {
          $lookup: {
            from: 'lessons',
            let: {
              trainingId: '$trainingId',
              moduleIds: '$modules._id',
              certificateAt: {
                $arrayElemAt: ['$certificate.issuedAt', 0],
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$trainingId', '$$trainingId'] },
                      { $in: ['$moduleId', '$$moduleIds'] },
                      {
                        $or: [
                          { $eq: [{ $type: '$$certificateAt' }, 'missing'] },
                          { $eq: ['$$certificateAt', null] },
                          { $lte: ['$createdAt', '$$certificateAt'] },
                        ],
                      },
                    ],
                  },
                  isArchived: false,
                },
              },
              { $project: { _id: 1 } },
            ],
            as: 'lessons',
          },
        },
        {
          $lookup: {
            from: LessonProgressModel.collection.name,
            let: { enrollmentId: '$_id', lessonIds: '$lessons._id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$enrollmentId', '$$enrollmentId'] },
                      { $in: ['$lessonId', '$$lessonIds'] },
                      { $eq: ['$completed', true] },
                    ],
                  },
                },
              },
            ],
            as: 'completed',
          },
        },
        {
          $project: {
            total: { $size: '$lessons' },
            completed: { $size: '$completed' },
            percentage: {
              $cond: [
                { $gt: [{ $size: '$lessons' }, 0] },
                {
                  $multiply: [
                    {
                      $divide: [{ $size: '$completed' }, { $size: '$lessons' }],
                    },
                    100,
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            enrollmentCount: { $sum: 1 },
            completedEnrollments: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$total', 0] },
                      { $eq: ['$completed', '$total'] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            averagePercentage: { $avg: '$percentage' },
          },
        },
        {
          $project: {
            _id: 0,
            enrollmentCount: 1,
            completedEnrollments: 1,
            averagePercentage: { $round: ['$averagePercentage', 2] },
          },
        },
      ]),
      EvaluationAttemptModel.aggregate<{
        totalAttempts: number;
        passedAttempts: number;
        failedAttempts: number;
      }>([
        {
          $match: {
            status: { $in: ['PASSED', 'FAILED'] },
            submittedAt: {
              $gte: range.startAt,
              $lt: range.endAtExclusive,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalAttempts: { $sum: 1 },
            passedAttempts: {
              $sum: { $cond: [{ $eq: ['$status', 'PASSED'] }, 1, 0] },
            },
            failedAttempts: {
              $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);
    const selfPaced = progressRows[0] ?? {
      enrollmentCount: 0,
      completedEnrollments: 0,
      averagePercentage: null,
    };
    const evaluation = evaluations[0] ?? {
      totalAttempts: 0,
      passedAttempts: 0,
      failedAttempts: 0,
    };
    return {
      period: period(range),
      selfPaced,
      evaluations: {
        ...evaluation,
        passPercent: percentage(
          evaluation.passedAttempts,
          evaluation.totalAttempts,
        ),
      },
    };
  }

  async satisfaction(
    principal: AuthenticatedPrincipal,
    input: DashboardRangeInput,
  ) {
    requireAdmin(principal);
    const range = tunisDateRange(input.from, input.to);
    const rows = await FeedbackModel.aggregate<{
      trainingId: string;
      trainingTitle: string;
      rating: number;
      count: number;
    }>([
      {
        $match: {
          createdAt: { $gte: range.startAt, $lt: range.endAtExclusive },
        },
      },
      {
        $group: {
          _id: { trainingId: '$trainingId', rating: '$rating' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: TrainingModel.collection.name,
          localField: '_id.trainingId',
          foreignField: '_id',
          as: 'training',
        },
      },
      {
        $project: {
          _id: 0,
          trainingId: { $toString: '$_id.trainingId' },
          trainingTitle: {
            $ifNull: [{ $arrayElemAt: ['$training.title', 0] }, 'Archived'],
          },
          rating: '$_id.rating',
          count: 1,
        },
      },
    ]);
    const globalValues = distribution();
    const grouped = new Map<
      string,
      { title: string; values: ReturnType<typeof distribution> }
    >();
    for (const row of rows) {
      const rating = row.rating as 1 | 2 | 3 | 4 | 5;
      globalValues[rating] += row.count;
      const value = grouped.get(row.trainingId) ?? {
        title: row.trainingTitle,
        values: distribution(),
      };
      value.values[rating] += row.count;
      grouped.set(row.trainingId, value);
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
      period: period(range),
      global: summary(globalValues),
      byTraining: [...grouped.entries()]
        .map(([id, value]) => ({
          training: { id, title: value.title },
          ...summary(value.values),
        }))
        .sort((left, right) =>
          left.training.title.localeCompare(right.training.title),
        ),
    };
  }

  async financial(
    principal: AuthenticatedPrincipal,
    input: DashboardRangeInput,
  ) {
    requireAdmin(principal);
    const range = tunisDateRange(input.from, input.to);
    return await this.#financial(range);
  }

  async profitability(
    principal: AuthenticatedPrincipal,
    input: DashboardRangeInput,
  ) {
    requireAdmin(principal);
    const range = tunisDateRange(input.from, input.to);
    const financial = await this.#financial(range);
    const [revenueRows, costRows] = await Promise.all([
      PaymentModel.aggregate<{ trainingId: string; amountMinor: number }>([
        {
          $match: {
            status: 'PAID',
            paidAt: { $gte: range.startAt, $lt: range.endAtExclusive },
          },
        },
        {
          $group: { _id: '$trainingId', amountMinor: { $sum: '$amountMinor' } },
        },
        {
          $project: {
            _id: 0,
            trainingId: { $toString: '$_id' },
            amountMinor: 1,
          },
        },
      ]),
      TrainingCostModel.aggregate<{
        trainingId: string;
        amountMinor: number;
      }>([
        {
          $match: {
            incurredOn: { $gte: range.startAt, $lt: range.endAtExclusive },
          },
        },
        {
          $group: { _id: '$trainingId', amountMinor: { $sum: '$amountMinor' } },
        },
        {
          $project: {
            _id: 0,
            trainingId: { $toString: '$_id' },
            amountMinor: 1,
          },
        },
      ]),
    ]);
    const ids = [
      ...new Set([
        ...revenueRows.map(({ trainingId }) => trainingId),
        ...costRows.map(({ trainingId }) => trainingId),
      ]),
    ];
    const titles = await TrainingModel.aggregate<{
      id: string;
      title: string;
    }>([
      { $match: { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
      { $project: { _id: 0, id: { $toString: '$_id' }, title: 1 } },
    ]);
    const titleById = new Map(titles.map((value) => [value.id, value.title]));
    const revenueById = new Map(
      revenueRows.map((value) => [value.trainingId, value.amountMinor]),
    );
    const costById = new Map(
      costRows.map((value) => [value.trainingId, value.amountMinor]),
    );
    return {
      ...financial,
      resultMinor:
        financial.revenueMinor -
        financial.trainerCostsMinor -
        financial.trainingCostsMinor,
      profitabilityPercent:
        financial.revenueMinor === 0
          ? null
          : Number(
              (
                ((financial.revenueMinor -
                  financial.trainerCostsMinor -
                  financial.trainingCostsMinor) /
                  financial.revenueMinor) *
                100
              ).toFixed(2),
            ),
      byTraining: ids
        .map((id) => {
          const revenueMinor = revenueById.get(id) ?? 0;
          const trainingCostsMinor = costById.get(id) ?? 0;
          return {
            training: { id, title: titleById.get(id) ?? 'Archived' },
            revenueMinor,
            trainingCostsMinor,
            resultBeforeFixedTrainerCostsMinor:
              revenueMinor - trainingCostsMinor,
          };
        })
        .sort((left, right) =>
          left.training.title.localeCompare(right.training.title),
        ),
    };
  }

  async #financial(range: TunisDateRange) {
    const monthFilter =
      range.fullMonths.length === 0
        ? { _id: { $exists: false } }
        : {
            $or: range.fullMonths.map(({ year, month }) => ({ year, month })),
          };
    const [revenue, trainerCosts, trainingCosts] = await Promise.all([
      PaymentModel.aggregate<{ total: number }>([
        {
          $match: {
            status: 'PAID',
            paidAt: { $gte: range.startAt, $lt: range.endAtExclusive },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]),
      TrainerCostModel.aggregate<{ total: number }>([
        { $match: monthFilter },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]),
      TrainingCostModel.aggregate<{ total: number }>([
        {
          $match: {
            incurredOn: { $gte: range.startAt, $lt: range.endAtExclusive },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountMinor' } } },
      ]),
    ]);
    const trainerCostsMinor = trainerCosts[0]?.total ?? 0;
    const trainingCostsMinor = trainingCosts[0]?.total ?? 0;
    return {
      period: period(range),
      currency: 'TND' as const,
      includedTrainerMonths: range.fullMonths,
      revenueMinor: revenue[0]?.total ?? 0,
      trainerCostsMinor,
      trainingCostsMinor,
      totalCostsMinor: trainerCostsMinor + trainingCostsMinor,
    };
  }
}

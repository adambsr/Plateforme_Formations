import mongoose, { type QueryFilter } from 'mongoose';

import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { CertificateModel } from '../../certificates/models/certificate.model.js';
import { LessonModel } from '../../content/models/lesson.model.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { EvaluationModel } from '../../evaluations/models/evaluation.model.js';
import { PaymentModel } from '../../payments/models/payment.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import type { Training } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type { Evaluation } from '../../evaluations/models/evaluation.model.js';
import type { DashboardSearchInput } from '../dto/search.dto.js';

export type SearchResultType =
  | 'TRAINING'
  | 'LESSON'
  | 'SESSION'
  | 'USER'
  | 'EVALUATION'
  | 'PAYMENT'
  | 'CERTIFICATE';

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  link: string;
}

function escapedRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function userSearchFilter(query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  return {
    $and: terms.map((term) => {
      const pattern = escapedRegex(term);
      return {
        $or: [
          { email: pattern },
          { 'profile.firstName': pattern },
          { 'profile.lastName': pattern },
        ],
      };
    }),
  };
}

function displayName(user: {
  email: string;
  profile: { firstName?: string; lastName?: string };
}): string {
  return (
    [user.profile.firstName, user.profile.lastName].filter(Boolean).join(' ') ||
    user.email
  );
}

export class SearchService {
  async search(
    principal: AuthenticatedPrincipal,
    input: DashboardSearchInput,
  ): Promise<{
    query: string;
    groups: Array<{ type: SearchResultType; items: SearchResult[] }>;
  }> {
    const pattern = escapedRegex(input.q);
    const learnerTrainingIds =
      principal.role === 'LEARNER'
        ? await EnrollmentModel.find({ learnerId: principal.userId }).distinct(
            'trainingId',
          )
        : [];
    const learnerSessionIds =
      principal.role === 'LEARNER'
        ? await EnrollmentModel.find({
            learnerId: principal.userId,
            sessionId: { $type: 'objectId' },
          }).distinct('sessionId')
        : [];
    const trainerTrainingIds =
      principal.role === 'TRAINER'
        ? await TrainingModel.find({
            ownerTrainerId: principal.userId,
          }).distinct('_id')
        : [];
    const trainerSessions =
      principal.role === 'TRAINER'
        ? await TrainingSessionModel.find({
            $or: [
              { trainingId: { $in: trainerTrainingIds } },
              {
                assignedTrainerIds: new mongoose.Types.ObjectId(
                  principal.userId,
                ),
              },
            ],
          })
            .select({ _id: 1, trainingId: 1 })
            .lean()
            .exec()
        : [];
    const trainerSessionIds = trainerSessions.map(({ _id }) => _id);
    const trainerVisibleTrainingIds = [
      ...new Map(
        [
          ...trainerTrainingIds,
          ...trainerSessions.map(({ trainingId }) => trainingId),
        ].map((id) => [String(id), id]),
      ).values(),
    ];

    const trainingFilter: QueryFilter<Training> =
      principal.role === 'ADMIN'
        ? {}
        : principal.role === 'TRAINER'
          ? { _id: { $in: trainerVisibleTrainingIds } }
          : { status: 'PUBLISHED' as const };
    const sessionFilter =
      principal.role === 'ADMIN'
        ? {}
        : principal.role === 'TRAINER'
          ? { _id: { $in: trainerSessionIds } }
          : { _id: { $in: learnerSessionIds } };
    const contentTrainingIds =
      principal.role === 'ADMIN'
        ? undefined
        : principal.role === 'TRAINER'
          ? trainerVisibleTrainingIds
          : learnerTrainingIds;
    const evaluationFilter: QueryFilter<Evaluation> =
      principal.role === 'ADMIN'
        ? {}
        : principal.role === 'TRAINER'
          ? { ownerTrainerId: new mongoose.Types.ObjectId(principal.userId) }
          : {
              trainingId: { $in: learnerTrainingIds },
              status: 'PUBLISHED' as const,
            };

    let visibleLearnerIds: mongoose.Types.ObjectId[] = [];
    if (principal.role === 'TRAINER') {
      visibleLearnerIds = await EnrollmentModel.find({
        $or: [
          { trainingId: { $in: trainerVisibleTrainingIds } },
          { sessionId: { $in: trainerSessionIds } },
        ],
      }).distinct('learnerId');
    }

    const [
      trainings,
      sessions,
      lessons,
      evaluations,
      users,
      payments,
      certificates,
    ] = await Promise.all([
      TrainingModel.find({
        ...trainingFilter,
        $or: [{ title: pattern }, { description: pattern }],
      })
        .select({ title: 1, type: 1, status: 1 })
        .limit(input.limit)
        .lean()
        .exec(),
      TrainingSessionModel.find({ ...sessionFilter, title: pattern })
        .select({ title: 1, identifier: 1, location: 1 })
        .limit(input.limit)
        .lean()
        .exec(),
      LessonModel.find({
        ...(contentTrainingIds === undefined
          ? {}
          : { trainingId: { $in: contentTrainingIds } }),
        isArchived: false,
        title: pattern,
      })
        .select({ title: 1, trainingId: 1 })
        .limit(input.limit)
        .lean()
        .exec(),
      EvaluationModel.find({ ...evaluationFilter, title: pattern })
        .select({ title: 1, status: 1 })
        .limit(input.limit)
        .lean()
        .exec(),
      principal.role === 'LEARNER'
        ? []
        : UserModel.find({
            ...(principal.role === 'ADMIN'
              ? {}
              : { _id: { $in: visibleLearnerIds }, role: 'LEARNER' }),
            ...userSearchFilter(input.q),
          })
            .select({ email: 1, profile: 1, role: 1 })
            .limit(input.limit)
            .lean()
            .exec(),
      principal.role === 'TRAINER'
        ? []
        : PaymentModel.find({
            ...(principal.role === 'LEARNER'
              ? { learnerId: new mongoose.Types.ObjectId(principal.userId) }
              : {}),
            $or: [
              { trainingTitle: pattern },
              { sessionTitle: pattern },
              { stripeCheckoutSessionId: pattern },
            ],
          })
            .select({
              trainingTitle: 1,
              status: 1,
              amountMinor: 1,
              currency: 1,
            })
            .limit(input.limit)
            .lean()
            .exec(),
      principal.role === 'TRAINER'
        ? []
        : CertificateModel.find({
            ...(principal.role === 'LEARNER'
              ? { learnerId: new mongoose.Types.ObjectId(principal.userId) }
              : {}),
            $or: [{ number: pattern }, { 'training.title': pattern }],
          })
            .select({ number: 1, training: 1 })
            .limit(input.limit)
            .lean()
            .exec(),
    ]);

    const groups: Array<{ type: SearchResultType; items: SearchResult[] }> = [
      {
        type: 'TRAINING',
        items: trainings.map((item) => ({
          id: String(item._id),
          type: 'TRAINING',
          title: item.title,
          subtitle:
            item.type === 'IN_PERSON'
              ? 'Formation en présentiel'
              : 'Formation en ligne',
          link:
            principal.role === 'LEARNER' &&
            learnerTrainingIds.some((id) => String(id) === String(item._id))
              ? `/app/content/${String(item._id)}`
              : principal.role === 'LEARNER'
                ? `/trainings/${String(item._id)}`
                : `/app/trainings/${String(item._id)}/edit`,
        })),
      },
      {
        type: 'SESSION',
        items: sessions.map((item) => ({
          id: String(item._id),
          type: 'SESSION',
          title: item.title,
          subtitle: [item.identifier, item.location]
            .filter(Boolean)
            .join(' · '),
          link:
            principal.role === 'LEARNER' ? '/app/attendance' : '/app/sessions',
        })),
      },
      {
        type: 'LESSON',
        items: lessons.map((item) => ({
          id: String(item._id),
          type: 'LESSON',
          title: item.title,
          subtitle: 'Cours',
          link: `/app/content/${String(item.trainingId)}`,
        })),
      },
      {
        type: 'USER',
        items: users.map((item) => ({
          id: String(item._id),
          type: 'USER',
          title: displayName(item),
          subtitle: `${item.role} · ${item.email}`,
          link: principal.role === 'ADMIN' ? '/app/users' : '/app/attendance',
        })),
      },
      {
        type: 'EVALUATION',
        items: evaluations.map((item) => ({
          id: String(item._id),
          type: 'EVALUATION',
          title: item.title,
          subtitle: item.status,
          link: `/app/evaluations/${String(item._id)}`,
        })),
      },
      {
        type: 'PAYMENT',
        items: payments.map((item) => ({
          id: String(item._id),
          type: 'PAYMENT',
          title: item.trainingTitle,
          subtitle: `${item.status} · ${(item.amountMinor / 100).toLocaleString('fr-FR', { style: 'currency', currency: item.currency })}`,
          link: '/app/payments',
        })),
      },
      {
        type: 'CERTIFICATE',
        items: certificates.map((item) => ({
          id: String(item._id),
          type: 'CERTIFICATE',
          title: item.training.title,
          subtitle: item.number,
          link: '/app/certificates',
        })),
      },
    ];

    return {
      query: input.q,
      groups: groups.filter(({ items }) => items.length > 0),
    };
  }
}

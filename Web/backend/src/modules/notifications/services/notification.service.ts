import { Types, type HydratedDocument } from 'mongoose';

import type { AppConfig } from '../../../config/environment.js';
import type { AuthenticatedPrincipal } from '../../../shared/auth/principal.js';
import { isDuplicateKeyError } from '../../../shared/database/mongo-errors.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EnrollmentModel } from '../../enrollments/models/enrollment.model.js';
import { SessionScheduleModel } from '../../sessions/models/session-schedule.model.js';
import { TrainingSessionModel } from '../../sessions/models/training-session.model.js';
import { TrainingModel } from '../../trainings/models/training.model.js';
import { UserModel } from '../../users/models/user.model.js';
import type {
  NotificationListInput,
  SendNotificationInput,
} from '../dto/notification.dto.js';
import {
  FirebaseMessagingGateway,
  type PushGateway,
} from '../infrastructure/firebase-messaging.gateway.js';
import { NotificationDeviceModel } from '../models/notification-device.model.js';
import {
  NotificationModel,
  type Notification,
} from '../models/notification.model.js';

export interface CreateInAppNotificationInput {
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  dedupeKey: string;
  occurredAt?: Date;
  link?: string;
  metadata?: Record<string, string>;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, string>;
}
type NotificationListener = (notification: NotificationView) => void;

const invalidTokenCodes = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

export class NotificationService {
  readonly #gateway: PushGateway | undefined;
  readonly #listeners = new Map<string, Set<NotificationListener>>();

  constructor(config: AppConfig['notifications'], gateway?: PushGateway) {
    this.#gateway = config.enabled
      ? (gateway ?? new FirebaseMessagingGateway())
      : undefined;
  }

  async createInApp(input: CreateInAppNotificationInput) {
    const ownership = {
      recipientUserId: new Types.ObjectId(input.recipientUserId),
      dedupeKey: input.dedupeKey,
    };
    let created = false;
    try {
      const result = await NotificationModel.updateOne(
        ownership,
        {
          $setOnInsert: {
            ...ownership,
            type: input.type,
            title: input.title,
            message: input.message,
            occurredAt: input.occurredAt ?? new Date(),
            readAt: null,
            ...(input.link === undefined ? {} : { link: input.link }),
            ...(input.metadata === undefined
              ? {}
              : { metadata: input.metadata }),
          },
        },
        { upsert: true, runValidators: true },
      ).exec();
      created = result.upsertedCount === 1;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }
    const notification = await NotificationModel.findOne(ownership).exec();
    if (notification === null) {
      throw new Error('Notification idempotence could not be resolved.');
    }
    const view = this.#view(notification);
    if (created) this.#publish(input.recipientUserId, view);
    return view;
  }

  subscribe(userId: string, listener: NotificationListener): () => void {
    const listeners = this.#listeners.get(userId) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(userId, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(userId);
    };
  }

  async createMany(inputs: readonly CreateInAppNotificationInput[]) {
    return await Promise.all(inputs.map((input) => this.createInApp(input)));
  }

  async notifyAdmins(
    input: Omit<
      CreateInAppNotificationInput,
      'recipientUserId' | 'dedupeKey'
    > & {
      dedupeKey: string;
    },
  ) {
    const adminIds = await UserModel.find({
      role: 'ADMIN',
      isActive: true,
    }).distinct('_id');
    return this.createMany(
      adminIds.map((id) => ({
        ...input,
        recipientUserId: String(id),
        dedupeKey: input.dedupeKey,
      })),
    );
  }

  async list(principal: AuthenticatedPrincipal, input: NotificationListInput) {
    await this.#materializeSessionReminders(principal);
    const filter = {
      recipientUserId: new Types.ObjectId(principal.userId),
      ...(input.state === 'UNREAD'
        ? { readAt: null }
        : input.state === 'READ'
          ? { readAt: { $ne: null } }
          : {}),
    };
    const [items, total, unread] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip((input.page - 1) * input.pageSize)
        .limit(input.pageSize)
        .exec(),
      NotificationModel.countDocuments(filter),
      NotificationModel.countDocuments({
        recipientUserId: new Types.ObjectId(principal.userId),
        readAt: null,
      }),
    ]);
    return {
      items: items.map((item) => this.#view(item)),
      page: input.page,
      pageSize: input.pageSize,
      total,
      unread,
    };
  }

  async unreadCount(principal: AuthenticatedPrincipal) {
    await this.#materializeSessionReminders(principal);
    return {
      unread: await NotificationModel.countDocuments({
        recipientUserId: new Types.ObjectId(principal.userId),
        readAt: null,
      }),
    };
  }

  async markRead(principal: AuthenticatedPrincipal, notificationId: string) {
    const notification = await NotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        recipientUserId: new Types.ObjectId(principal.userId),
      },
      { $set: { readAt: new Date() } },
      { returnDocument: 'after' },
    ).exec();
    if (notification === null) {
      throw new AppError(
        404,
        'NOTIFICATION_NOT_FOUND',
        'The Notification does not exist.',
      );
    }
    return this.#view(notification);
  }

  async markAllRead(principal: AuthenticatedPrincipal) {
    const result = await NotificationModel.updateMany(
      {
        recipientUserId: new Types.ObjectId(principal.userId),
        readAt: null,
      },
      { $set: { readAt: new Date() } },
    ).exec();
    return { updated: result.modifiedCount, unread: 0 };
  }

  async registerDevice(
    userId: string,
    input: { token: string; platform: 'ANDROID'; appVersion?: string },
  ) {
    const device = await NotificationDeviceModel.findOneAndUpdate(
      { token: input.token },
      {
        $set: {
          userId: new Types.ObjectId(userId),
          platform: input.platform,
          ...(input.appVersion === undefined
            ? {}
            : { appVersion: input.appVersion }),
          lastSeenAt: new Date(),
        },
      },
      { new: true, upsert: true, runValidators: true },
    ).exec();
    return { id: String(device._id), registered: true };
  }

  async unregisterDevice(userId: string, token: string): Promise<void> {
    await NotificationDeviceModel.deleteOne({
      userId: new Types.ObjectId(userId),
      token,
    }).exec();
  }

  async send(input: SendNotificationInput) {
    if (this.#gateway === undefined) {
      throw new AppError(
        503,
        'FCM_UNAVAILABLE',
        'Firebase Cloud Messaging is not enabled.',
      );
    }
    const devices = await NotificationDeviceModel.find({
      userId: {
        $in: input.recipientUserIds.map((id) => new Types.ObjectId(id)),
      },
    })
      .select({ token: 1 })
      .lean()
      .exec();
    const results = await this.#gateway.send(
      devices.map((device) => ({
        token: device.token,
        title: input.title,
        body: input.body,
        ...(input.data === undefined ? {} : { data: input.data }),
      })),
    );
    const staleTokens = results
      .filter(
        (result) =>
          !result.delivered &&
          result.errorCode !== undefined &&
          invalidTokenCodes.has(result.errorCode),
      )
      .map((result) => result.token);
    if (staleTokens.length > 0) {
      await NotificationDeviceModel.deleteMany({
        token: { $in: staleTokens },
      }).exec();
    }
    return {
      requestedDevices: devices.length,
      delivered: results.filter((result) => result.delivered).length,
      failed: results.filter((result) => !result.delivered).length,
      removedStaleTokens: staleTokens.length,
    };
  }

  async #materializeSessionReminders(
    principal: AuthenticatedPrincipal,
  ): Promise<void> {
    const now = new Date();
    const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
    let sessionIds: Types.ObjectId[] | undefined;
    if (principal.role === 'LEARNER') {
      sessionIds = await EnrollmentModel.find({
        learnerId: new Types.ObjectId(principal.userId),
        sessionId: { $type: 'objectId' },
      }).distinct('sessionId');
    } else if (principal.role === 'TRAINER') {
      sessionIds = await TrainingSessionModel.find({
        status: 'PLANNED',
        assignedTrainerIds: new Types.ObjectId(principal.userId),
      }).distinct('_id');
    }
    const schedules = await SessionScheduleModel.find({
      ...(sessionIds === undefined ? {} : { sessionId: { $in: sessionIds } }),
      startAt: { $gt: now, $lte: horizon },
      ...(principal.role === 'TRAINER'
        ? {
            $or: [
              { trainerIds: new Types.ObjectId(principal.userId) },
              { sessionId: { $in: sessionIds ?? [] } },
            ],
          }
        : {}),
    })
      .sort({ startAt: 1, _id: 1 })
      .limit(100)
      .exec();
    if (schedules.length === 0) return;
    const [sessions, trainings] = await Promise.all([
      TrainingSessionModel.find({
        _id: { $in: schedules.map(({ sessionId }) => sessionId) },
        status: 'PLANNED',
      })
        .select({ title: 1, trainingId: 1 })
        .lean()
        .exec(),
      TrainingModel.find({
        _id: { $in: schedules.map(({ trainingId }) => trainingId) },
      })
        .select({ title: 1 })
        .lean()
        .exec(),
    ]);
    const sessionById = new Map(
      sessions.map((item) => [String(item._id), item]),
    );
    const trainingById = new Map(
      trainings.map((item) => [String(item._id), item]),
    );
    for (const schedule of schedules) {
      const session = sessionById.get(String(schedule.sessionId));
      if (session === undefined) continue;
      const training = trainingById.get(String(schedule.trainingId));
      const inOneHour =
        schedule.startAt.getTime() - now.getTime() <= 60 * 60 * 1_000;
      const title = inOneHour ? 'Rappel de session' : 'Session à venir';
      const formatted = new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Tunis',
      }).format(schedule.startAt);
      await this.createInApp({
        recipientUserId: principal.userId,
        type: inOneHour ? 'SESSION_REMINDER' : 'SESSION_UPCOMING',
        title,
        message: inOneHour
          ? `Votre session « ${training?.title ?? session.title} » commence dans moins d’une heure.`
          : `Votre session « ${training?.title ?? session.title} » commence le ${formatted}.`,
        link:
          principal.role === 'LEARNER' ? '/app/attendance' : '/app/sessions',
        dedupeKey: `schedule:${String(schedule._id)}:${inOneHour ? '1h' : '24h'}`,
        occurredAt: now,
        metadata: {
          scheduleId: String(schedule._id),
          sessionId: String(session._id),
        },
      });
    }
  }

  #view(notification: HydratedDocument<Notification>): NotificationView {
    return {
      id: String(notification._id),
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: notification.occurredAt.toISOString(),
      read: notification.readAt !== null && notification.readAt !== undefined,
      ...(notification.link === undefined ? {} : { link: notification.link }),
      ...(notification.metadata === undefined
        ? {}
        : { metadata: notification.metadata }),
    };
  }

  #publish(userId: string, notification: NotificationView): void {
    for (const listener of this.#listeners.get(userId) ?? []) {
      try {
        listener(notification);
      } catch {
        // A disconnected stream must never make the business event fail.
      }
    }
  }
}

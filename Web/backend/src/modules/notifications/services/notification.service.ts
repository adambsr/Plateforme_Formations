import { Types } from 'mongoose';

import type { AppConfig } from '../../../config/environment.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { SendNotificationInput } from '../dto/notification.dto.js';
import {
  FirebaseMessagingGateway,
  type PushGateway,
} from '../infrastructure/firebase-messaging.gateway.js';
import { NotificationDeviceModel } from '../models/notification-device.model.js';

const invalidTokenCodes = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

export class NotificationService {
  readonly #gateway: PushGateway | undefined;

  constructor(config: AppConfig['notifications'], gateway?: PushGateway) {
    this.#gateway = config.enabled
      ? (gateway ?? new FirebaseMessagingGateway())
      : undefined;
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
}

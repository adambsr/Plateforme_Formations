import mongoose, { type Model, type Types } from 'mongoose';

export interface NotificationDevice {
  userId: Types.ObjectId;
  token: string;
  platform: 'ANDROID';
  appVersion?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationDeviceSchema = new mongoose.Schema<NotificationDevice>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    token: { type: String, required: true, trim: true, maxlength: 4096 },
    platform: { type: String, required: true, enum: ['ANDROID'] },
    appVersion: { type: String, trim: true, maxlength: 100 },
    lastSeenAt: { type: Date, required: true },
  },
  { collection: 'notification_devices', strict: 'throw', timestamps: true },
);

notificationDeviceSchema.index(
  { token: 1 },
  { unique: true, name: 'unique_notification_device_token' },
);
notificationDeviceSchema.index(
  { userId: 1, lastSeenAt: -1 },
  { name: 'notification_devices_by_user' },
);

export const NotificationDeviceModel =
  (mongoose.models.NotificationDevice as
    Model<NotificationDevice> | undefined) ??
  mongoose.model<NotificationDevice>(
    'NotificationDevice',
    notificationDeviceSchema,
  );

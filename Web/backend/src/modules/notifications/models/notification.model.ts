import mongoose, { type Model, type Types } from 'mongoose';

export interface Notification {
  recipientUserId: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, string>;
  dedupeKey: string;
  occurredAt: Date;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new mongoose.Schema<Notification>(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      immutable: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
      immutable: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    link: { type: String, trim: true, maxlength: 500 },
    metadata: {
      type: Map,
      of: { type: String, maxlength: 500 },
      default: undefined,
    },
    dedupeKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
      immutable: true,
    },
    occurredAt: { type: Date, required: true, immutable: true },
    readAt: { type: Date, default: null },
  },
  { collection: 'notifications', strict: 'throw', timestamps: true },
);

notificationSchema.index(
  { recipientUserId: 1, dedupeKey: 1 },
  { unique: true, name: 'unique_notification_event_per_recipient' },
);
notificationSchema.index(
  { recipientUserId: 1, occurredAt: -1, _id: -1 },
  { name: 'notification_feed_by_recipient' },
);
notificationSchema.index(
  { recipientUserId: 1, readAt: 1, occurredAt: -1 },
  { name: 'notification_unread_by_recipient' },
);

export const NotificationModel =
  (mongoose.models.Notification as Model<Notification> | undefined) ??
  mongoose.model<Notification>('Notification', notificationSchema);

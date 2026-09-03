import { z } from 'zod';

const deviceToken = z.string().trim().min(20).max(4096);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user identifier.');

export const registerDeviceSchema = z
  .object({
    token: deviceToken,
    platform: z.literal('ANDROID'),
    appVersion: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const unregisterDeviceSchema = z.object({ token: deviceToken }).strict();

export const sendNotificationSchema = z
  .object({
    recipientUserIds: z.array(objectId).min(1).max(500),
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(240),
    data: z
      .record(z.string().trim().min(1).max(80), z.string().max(200))
      .optional(),
  })
  .strict();

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

import {
  applicationDefault,
  getApp,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushDeliveryResult {
  token: string;
  delivered: boolean;
  errorCode?: string;
}

export interface PushGateway {
  send(
    messages: readonly PushMessage[],
  ): Promise<readonly PushDeliveryResult[]>;
}

export class FirebaseMessagingGateway implements PushGateway {
  #messaging = getMessaging(
    getApps().length === 0
      ? initializeApp({ credential: applicationDefault() })
      : getApp(),
  );

  async send(
    messages: readonly PushMessage[],
  ): Promise<readonly PushDeliveryResult[]> {
    if (messages.length === 0) return [];
    const response = await this.#messaging.sendEach(
      messages.map((message): Message => ({
        token: message.token,
        notification: { title: message.title, body: message.body },
        ...(message.data === undefined ? {} : { data: message.data }),
        android: {
          priority: 'high',
          notification: { channelId: 'hsa-default' },
        },
      })),
    );
    return response.responses.map((result, index) => ({
      token: messages[index]!.token,
      delivered: result.success,
      ...(result.success || result.error === undefined
        ? {}
        : { errorCode: result.error.code }),
    }));
  }
}

import nodemailer from 'nodemailer';

import type { AppConfig } from '../../config/environment.js';

export interface EmailAttachment {
  filename: string;
  path: string;
  cid: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  attachments?: readonly EmailAttachment[];
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class NodemailerEmailProvider implements EmailProvider {
  readonly #config: AppConfig;
  readonly #transport: ReturnType<typeof nodemailer.createTransport>;

  constructor(config: AppConfig) {
    this.#config = config;
    const auth =
      config.smtp.user === undefined || config.smtp.password === undefined
        ? undefined
        : { user: config.smtp.user, pass: config.smtp.password };
    this.#transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      requireTLS: config.smtp.requireTls,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: { minVersion: 'TLSv1.2' },
      ...(auth === undefined ? {} : { auth }),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.#config.email.deliveryEnabled) return;
    const isTestDelivery = this.#config.email.testRecipient !== undefined;
    const replyTo = isTestDelivery
      ? this.#config.email.testRecipient
      : message.replyTo;
    await this.#transport.sendMail({
      from: this.#config.email.from,
      to: this.#config.email.testRecipient ?? message.to,
      subject: `${isTestDelivery ? '[TEST] ' : ''}${message.subject}`,
      text: message.text,
      html: message.html,
      ...(replyTo === undefined ? {} : { replyTo }),
      ...(message.attachments === undefined
        ? {}
        : { attachments: [...message.attachments] }),
    });
  }
}

export function createEmailProvider(config: AppConfig): EmailProvider {
  switch (config.email.provider) {
    case 'mailpit':
    case 'smtp':
      return new NodemailerEmailProvider(config);
  }
}

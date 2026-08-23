import nodemailer from 'nodemailer';

import type { AppConfig } from '../../config/environment.js';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactMailService {
  sendContactMessage(message: ContactMessage): Promise<void>;
}

export function createContactMailService(
  config: AppConfig,
): ContactMailService {
  const auth =
    config.smtp.user === undefined || config.smtp.password === undefined
      ? undefined
      : { user: config.smtp.user, pass: config.smtp.password };
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(auth === undefined ? {} : { auth }),
  });

  return {
    async sendContactMessage(message) {
      await transporter.sendMail({
        from: config.smtp.from,
        to: config.center.email,
        replyTo: message.email,
        subject: `[Contact High Skills Academy] ${message.subject}`,
        text: [
          `Nom : ${message.name}`,
          `Adresse e-mail : ${message.email}`,
          '',
          message.message,
        ].join('\n'),
      });
    },
  };
}

import nodemailer from 'nodemailer';

import type { AppConfig } from '../../config/environment.js';

export interface PasswordResetMailService {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}

export function createPasswordResetMailService(
  config: AppConfig,
): PasswordResetMailService {
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
    async sendPasswordReset(email, resetUrl) {
      await transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject: 'Réinitialisation de votre mot de passe',
        text: `Utilisez ce lien pour réinitialiser votre mot de passe : ${resetUrl}`,
      });
    },
  };
}

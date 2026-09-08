import type { AppConfig } from '../../config/environment.js';
import { createEmailProvider, type EmailProvider } from './email-provider.js';
import {
  certificateAwardedEmail,
  contactMessageEmail,
  enrollmentConfirmationEmail,
  passwordChangedEmail,
  passwordResetEmail,
  sessionEmail,
  trainingCompletedEmail,
  welcomeEmail,
  type EmailBrand,
  type RenderedEmail,
  type SessionEmailKind,
} from './email-templates.js';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface TransactionalEmailService {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
  sendContactMessage(message: ContactMessage): Promise<void>;
  sendWelcome(input: {
    email: string;
    firstName?: string;
    temporaryPassword?: boolean;
  }): Promise<void>;
  sendPasswordChanged(input: {
    email: string;
    firstName?: string;
  }): Promise<void>;
  sendEnrollmentConfirmation(input: {
    email: string;
    firstName?: string;
    trainingTitle: string;
    sessionTitle?: string;
    amountMinor: number;
    currency: string;
  }): Promise<void>;
  sendCertificateAwarded(input: {
    email: string;
    firstName?: string;
    trainingTitle: string;
    certificateNumber: string;
  }): Promise<void>;
  sendSessionNotification(input: {
    recipients: readonly string[];
    kind: SessionEmailKind;
    sessionId: string;
    trainingTitle: string;
    sessionTitle: string;
    startsAt?: string;
    location?: string;
  }): Promise<void>;
  sendTrainingCompleted(input: {
    email: string;
    firstName?: string;
    trainingTitle: string;
  }): Promise<void>;
}

export const noopTransactionalEmailService: TransactionalEmailService = {
  async sendPasswordReset() {},
  async sendContactMessage() {},
  async sendWelcome() {},
  async sendPasswordChanged() {},
  async sendEnrollmentConfirmation() {},
  async sendCertificateAwarded() {},
  async sendSessionNotification() {},
  async sendTrainingCompleted() {},
};

export class DefaultTransactionalEmailService implements TransactionalEmailService {
  readonly #config: AppConfig;
  readonly #provider: EmailProvider;
  readonly #brand: EmailBrand;

  constructor(config: AppConfig, provider: EmailProvider) {
    this.#config = config;
    this.#provider = provider;
    this.#brand = {
      centerName: config.center.name,
      supportAddress: config.email.supportAddress,
      ...(config.center.logoPath === undefined ? {} : { logoCid: 'hsa-logo' }),
    };
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    await this.#send(
      email,
      passwordResetEmail(this.#brand, {
        resetUrl,
        expiresInMinutes: this.#config.authentication.passwordResetTtlMinutes,
      }),
    );
  }

  async sendContactMessage(message: ContactMessage): Promise<void> {
    await this.#send(
      this.#config.email.contactTo,
      contactMessageEmail(this.#brand, message),
      message.email,
    );
  }

  async sendWelcome(input: {
    email: string;
    firstName?: string;
    temporaryPassword?: boolean;
  }): Promise<void> {
    await this.#send(
      input.email,
      welcomeEmail(this.#brand, {
        ...(input.firstName === undefined
          ? {}
          : { firstName: input.firstName }),
        appUrl: this.#config.application.webAppUrl,
        ...(input.temporaryPassword === undefined
          ? {}
          : { temporaryPassword: input.temporaryPassword }),
      }),
    );
  }

  async sendPasswordChanged(input: {
    email: string;
    firstName?: string;
  }): Promise<void> {
    await this.#send(
      input.email,
      passwordChangedEmail(this.#brand, {
        ...(input.firstName === undefined
          ? {}
          : { firstName: input.firstName }),
        supportAddress: this.#config.email.supportAddress,
      }),
    );
  }

  async sendEnrollmentConfirmation(input: {
    email: string;
    firstName?: string;
    trainingTitle: string;
    sessionTitle?: string;
    amountMinor: number;
    currency: string;
  }): Promise<void> {
    await this.#send(
      input.email,
      enrollmentConfirmationEmail(this.#brand, {
        ...(input.firstName === undefined
          ? {}
          : { firstName: input.firstName }),
        trainingTitle: input.trainingTitle,
        ...(input.sessionTitle === undefined
          ? {}
          : { sessionTitle: input.sessionTitle }),
        amountMinor: input.amountMinor,
        currency: input.currency,
        appUrl: this.#config.application.webAppUrl,
      }),
    );
  }

  async sendCertificateAwarded(input: {
    email: string;
    firstName?: string;
    trainingTitle: string;
    certificateNumber: string;
  }): Promise<void> {
    await this.#send(
      input.email,
      certificateAwardedEmail(this.#brand, {
        ...(input.firstName === undefined
          ? {}
          : { firstName: input.firstName }),
        trainingTitle: input.trainingTitle,
        certificateNumber: input.certificateNumber,
        certificatesUrl: `${this.#config.application.webAppUrl}/app/certificates`,
      }),
    );
  }

  async sendSessionNotification(input: {
    recipients: readonly string[];
    kind: SessionEmailKind;
    sessionId: string;
    trainingTitle: string;
    sessionTitle: string;
    startsAt?: string;
    location?: string;
  }): Promise<void> {
    const rendered = sessionEmail(this.#brand, {
      kind: input.kind,
      trainingTitle: input.trainingTitle,
      sessionTitle: input.sessionTitle,
      ...(input.startsAt === undefined ? {} : { startsAt: input.startsAt }),
      ...(input.location === undefined ? {} : { location: input.location }),
      sessionUrl: `${this.#config.application.webAppUrl}/app`,
    });
    await Promise.all(
      [...new Set(input.recipients)].map((email) =>
        this.#send(email, rendered),
      ),
    );
  }

  async sendTrainingCompleted(input: {
    email: string;
    firstName?: string;
    trainingTitle: string;
  }): Promise<void> {
    await this.#send(
      input.email,
      trainingCompletedEmail(this.#brand, {
        ...(input.firstName === undefined
          ? {}
          : { firstName: input.firstName }),
        trainingTitle: input.trainingTitle,
        appUrl: this.#config.application.webAppUrl,
      }),
    );
  }

  async #send(
    to: string,
    rendered: RenderedEmail,
    replyTo?: string,
  ): Promise<void> {
    await this.#provider.send({
      to,
      ...rendered,
      ...(replyTo === undefined ? {} : { replyTo }),
      ...(this.#config.center.logoPath === undefined
        ? {}
        : {
            attachments: [
              {
                filename: 'high-skills-academy.png',
                path: this.#config.center.logoPath,
                cid: 'hsa-logo',
              },
            ],
          }),
    });
  }
}

export function createTransactionalEmailService(
  config: AppConfig,
): TransactionalEmailService {
  return new DefaultTransactionalEmailService(
    config,
    createEmailProvider(config),
  );
}

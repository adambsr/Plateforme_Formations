import { describe, expect, it, vi } from 'vitest';

import { loadAppConfig } from '../src/config/environment.js';
import type {
  EmailMessage,
  EmailProvider,
} from '../src/infrastructure/mail/email-provider.js';
import { createEmailProvider } from '../src/infrastructure/mail/email-provider.js';
import { DefaultTransactionalEmailService } from '../src/infrastructure/mail/email-service.js';
import { contactMessageSchema } from '../src/modules/contact/dto/contact.dto.js';
import { validEnvironment } from './fixtures/environment.js';

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('nodemailer', () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

class CapturingProvider implements EmailProvider {
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.messages.push(message);
  }
}

function service() {
  const config = loadAppConfig({
    ...validEnvironment(),
    EMAIL_FROM: 'High Skills Academy <no-reply@academy.example>',
    EMAIL_CONTACT_TO: 'contact@academy.example',
    EMAIL_SUPPORT_ADDRESS: 'support@academy.example',
  });
  const provider = new CapturingProvider();
  return {
    config,
    provider,
    mail: new DefaultTransactionalEmailService(config, provider),
  };
}

describe('transactional email foundation', () => {
  it('renders branded HTML and plain text password reset mail with the configured URL', async () => {
    const { mail, provider } = service();
    const resetUrl =
      'https://academy.example/reset-password?token=opaque%2Btoken';

    await mail.sendPasswordReset('learner@example.com', resetUrl);

    expect(provider.messages).toHaveLength(1);
    expect(provider.messages[0]).toMatchObject({
      to: 'learner@example.com',
      subject: 'Réinitialisation de votre mot de passe',
    });
    expect(provider.messages[0]?.text).toContain(resetUrl);
    expect(provider.messages[0]?.text).toContain('30 minutes');
    expect(provider.messages[0]?.html).toContain('<!doctype html>');
    expect(provider.messages[0]?.html).toContain(
      'Réinitialiser mon mot de passe',
    );
    expect(provider.messages[0]?.html).toContain('max-width:640px');
  });

  it('routes contact mail only to the configured mailbox and escapes untrusted HTML', async () => {
    const { mail, provider } = service();
    await mail.sendContactMessage({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      subject: 'Question <urgente>',
      message: 'Bonjour <script>alert(1)</script>',
    });

    expect(provider.messages[0]).toMatchObject({
      to: 'contact@academy.example',
      replyTo: 'ada@example.com',
      subject: '[Contact High Skills Academy] Question <urgente>',
    });
    expect(provider.messages[0]?.html).not.toContain('<script>');
    expect(provider.messages[0]?.html).toContain('&lt;script&gt;');
    expect(provider.messages[0]?.text).toContain(
      'Bonjour <script>alert(1)</script>',
    );
  });

  it('provides HTML and text variants for lifecycle email types', async () => {
    const { mail, provider } = service();
    await mail.sendWelcome({ email: 'learner@example.com', firstName: 'Ada' });
    await mail.sendPasswordChanged({
      email: 'learner@example.com',
      firstName: 'Ada',
    });
    await mail.sendEnrollmentConfirmation({
      email: 'learner@example.com',
      firstName: 'Ada',
      trainingTitle: 'TypeScript',
      amountMinor: 12_500,
      currency: 'EUR',
    });
    await mail.sendTrainingCompleted({
      email: 'learner@example.com',
      trainingTitle: 'TypeScript',
    });
    await mail.sendCertificateAwarded({
      email: 'learner@example.com',
      trainingTitle: 'TypeScript',
      certificateNumber: 'CERT-2026-ABC',
    });
    await mail.sendSessionNotification({
      recipients: ['learner@example.com', 'learner@example.com'],
      kind: 'reminder',
      sessionId: '507f1f77bcf86cd799439011',
      trainingTitle: 'TypeScript',
      sessionTitle: 'Septembre',
      startsAt: '2026-09-10T08:00:00.000Z',
    });

    expect(provider.messages).toHaveLength(6);
    for (const message of provider.messages) {
      expect(message.text.length).toBeGreaterThan(20);
      expect(message.html).toContain('Test Centre');
      expect(message.html).toContain('support@academy.example');
    }
  });

  it('rejects contact header injection and strips unsafe body controls', () => {
    expect(
      contactMessageSchema.safeParse({
        name: 'Ada\r\nBcc: victim@example.com',
        email: 'ada@example.com',
        subject: 'Question légitime',
        message: 'Un message suffisamment long.',
      }).success,
    ).toBe(false);
    expect(
      contactMessageSchema.safeParse({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        subject: 'Question\nBcc: victim@example.com',
        message: 'Un message suffisamment long.',
      }).success,
    ).toBe(false);
    expect(
      contactMessageSchema.parse({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        subject: 'Question légitime',
        message: 'Un message\u0007 suffisamment long.',
      }).message,
    ).toBe('Un message suffisamment long.');
  });

  it('requires authenticated SMTP for enabled production delivery', () => {
    expect(() =>
      loadAppConfig({
        ...validEnvironment(),
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'mailpit',
      }),
    ).toThrow(/EMAIL_PROVIDER=smtp/);

    expect(() =>
      loadAppConfig({
        ...validEnvironment(),
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'smtp',
      }),
    ).toThrow(/SMTP_USER/);

    expect(
      loadAppConfig({
        ...validEnvironment(),
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'smtp',
        SMTP_REQUIRE_TLS: 'true',
        SMTP_USER: 'brevo-login',
        SMTP_PASSWORD: 'brevo-key',
      }).email.provider,
    ).toBe('smtp');
  });

  it('redirects provider-test delivery without exposing the original recipient', async () => {
    sendMail.mockClear();
    const config = loadAppConfig({
      ...validEnvironment(),
      EMAIL_TEST_RECIPIENT: 'owner@academy.example',
    });
    await createEmailProvider(config).send({
      to: 'real-user@example.com',
      subject: 'Bienvenue',
      text: 'Texte',
      html: '<p>Texte</p>',
      replyTo: 'real-user@example.com',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@example.com',
        to: 'owner@academy.example',
        replyTo: 'owner@academy.example',
        subject: '[TEST] Bienvenue',
      }),
    );
    expect(JSON.stringify(sendMail.mock.calls)).not.toContain(
      'real-user@example.com',
    );
  });

  it('passes the legacy SMTP_FROM fallback to the mail transport', async () => {
    sendMail.mockClear();
    const environment = validEnvironment();
    delete environment.EMAIL_FROM;
    environment.SMTP_FROM = 'Legacy Sender <legacy@example.com>';

    await createEmailProvider(loadAppConfig(environment)).send({
      to: 'learner@example.com',
      subject: 'Bienvenue',
      text: 'Texte',
      html: '<p>Texte</p>',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Legacy Sender <legacy@example.com>',
        to: 'learner@example.com',
      }),
    );
  });
});

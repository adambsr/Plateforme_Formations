import type { ContactMailService } from '../../../infrastructure/mail/contact-mail.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type { ContactMessageInput } from '../dto/contact.dto.js';

export class ContactService {
  readonly #mail: ContactMailService;

  constructor(mail: ContactMailService) {
    this.#mail = mail;
  }

  async send(input: ContactMessageInput): Promise<{ message: string }> {
    try {
      await this.#mail.sendContactMessage(input);
    } catch {
      throw new AppError(
        503,
        'CONTACT_DELIVERY_FAILED',
        'Votre message n’a pas pu être envoyé pour le moment. Veuillez réessayer plus tard.',
      );
    }
    return { message: 'Votre message a bien été envoyé.' };
  }
}

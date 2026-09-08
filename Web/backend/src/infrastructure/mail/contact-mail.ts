import type { AppConfig } from '../../config/environment.js';
import {
  createTransactionalEmailService,
  type ContactMessage,
} from './email-service.js';

export type { ContactMessage } from './email-service.js';

export interface ContactMailService {
  sendContactMessage(message: ContactMessage): Promise<void>;
}

export function createContactMailService(
  config: AppConfig,
): ContactMailService {
  return createTransactionalEmailService(config);
}

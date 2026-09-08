import type { AppConfig } from '../../config/environment.js';
import { createTransactionalEmailService } from './email-service.js';

export interface PasswordResetMailService {
  sendPasswordReset(email: string, resetUrl: string): Promise<void>;
}

export function createPasswordResetMailService(
  config: AppConfig,
): PasswordResetMailService {
  return createTransactionalEmailService(config);
}

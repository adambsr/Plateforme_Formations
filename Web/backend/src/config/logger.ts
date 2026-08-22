import pino, { type DestinationStream, type Logger } from 'pino';

import type { AppConfig } from './environment.js';

const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["stripe-signature"]',
  'res.headers["set-cookie"]',
  'authorization',
  'password',
  'token',
  'secret',
  '*.password',
  '*.token',
  '*.secret',
  'config.database.uri',
  'config.authentication.jwtAccessSecret',
  'config.smtp.password',
  'config.stripe.secretKey',
  'config.stripe.webhookSecret',
  'config.ai.apiKey',
];

export function createLogger(
  config: AppConfig,
  destination?: DestinationStream,
): Logger {
  const options = {
    level: config.application.logLevel,
    base: { service: 'plateforme-formations-backend' },
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return destination === undefined ? pino(options) : pino(options, destination);
}

import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { loadAppConfig } from '../src/config/environment.js';
import { createLogger } from '../src/config/logger.js';
import { validEnvironment } from './fixtures/environment.js';

describe('createLogger', () => {
  it('redacts common credentials and provider configuration', () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const environment = validEnvironment();
    environment.LOG_LEVEL = 'info';
    const config = loadAppConfig(environment);
    const logger = createLogger(config, destination);

    logger.info(
      {
        password: 'plain-password',
        token: 'plain-token',
        config,
        req: {
          headers: {
            authorization: 'Bearer access-token',
            cookie: 'refresh=token',
            'stripe-signature': 'timestamp-and-webhook-signature',
          },
        },
      },
      'redaction check',
    );

    const output = chunks.join('');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('plain-password');
    expect(output).not.toContain('plain-token');
    expect(output).not.toContain(config.authentication.jwtAccessSecret);
    expect(output).not.toContain(config.database.uri);
    expect(output).not.toContain(config.stripe.secretKey);
    expect(output).not.toContain(config.ai.apiKey);
    expect(output).not.toContain('Bearer access-token');
    expect(output).not.toContain('refresh=token');
    expect(output).not.toContain('timestamp-and-webhook-signature');
  });
});

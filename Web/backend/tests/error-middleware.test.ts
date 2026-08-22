import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { errorHandler } from '../src/infrastructure/http/error-middleware.js';
import { requestLogging } from '../src/infrastructure/http/request-logging.js';
import { AppError } from '../src/shared/errors/app-error.js';

function errorTestApp() {
  const app = express();
  app.use(requestLogging(pino({ level: 'silent' })));
  app.get('/application', () => {
    throw new AppError(
      409,
      'STATE_CONFLICT',
      'The requested transition is not allowed.',
      [{ field: 'status', message: 'The status cannot change.' }],
    );
  });
  app.get('/validation', () => {
    z.object({ count: z.number().positive() }).parse({ count: -1 });
  });
  app.get('/unexpected', () => {
    throw new Error('sensitive implementation detail');
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('serializes expected application conflicts with field errors', async () => {
    const response = await request(errorTestApp()).get('/application');

    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({
      code: 'STATE_CONFLICT',
      message: 'The requested transition is not allowed.',
      fieldErrors: [{ field: 'status', message: 'The status cannot change.' }],
    });
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('maps schema issues to the validation contract', async () => {
    const response = await request(errorTestApp()).get('/validation');

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.fieldErrors[0]).toMatchObject({
      field: 'count',
    });
  });

  it('does not expose unexpected error details', async () => {
    const response = await request(errorTestApp()).get('/unexpected');

    expect(response.status).toBe(500);
    expect(response.body.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred.',
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'sensitive implementation detail',
    );
  });
});

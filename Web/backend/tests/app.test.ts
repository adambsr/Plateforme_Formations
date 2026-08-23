import pino from 'pino';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../src/app.js';
import { loadAppConfig } from '../src/config/environment.js';
import { validEnvironment } from './fixtures/environment.js';

function testApp(databaseReady = true) {
  return createApp({
    config: loadAppConfig(validEnvironment()),
    logger: pino({ level: 'silent' }),
    databaseReady: () => databaseReady,
  });
}

describe('HTTP foundation', () => {
  it('returns healthy when the database is ready', async () => {
    const response = await request(testApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'plateforme-formations-backend',
      version: '0.1.0',
      checks: { database: 'up' },
    });
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-request-id']).toBeTypeOf('string');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('returns degraded readiness when the database is unavailable', async () => {
    const response = await request(testApp(false)).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: { database: 'down' },
    });
  });

  it('preserves a safe caller request ID', async () => {
    const response = await request(testApp())
      .get('/api/health')
      .set('x-request-id', 'phase0-check');

    expect(response.headers['x-request-id']).toBe('phase0-check');
  });

  it('allows configured CORS origins and does not reflect other origins', async () => {
    const [allowed, rejected] = await Promise.all([
      request(testApp())
        .get('/api/health')
        .set('origin', 'http://localhost:5173'),
      request(testApp())
        .get('/api/health')
        .set('origin', 'https://untrusted.example'),
    ]);

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves a synchronized OpenAPI document and documentation UI', async () => {
    const [documentResponse, uiResponse] = await Promise.all([
      request(testApp()).get('/api/openapi.json'),
      request(testApp()).get('/api/docs/'),
    ]);

    expect(documentResponse.status).toBe(200);
    expect(documentResponse.body.openapi).toBe('3.0.3');
    expect(documentResponse.body.paths['/health'].get.operationId).toBe(
      'getHealth',
    );
    expect(
      documentResponse.body.components.securitySchemes.bearerAuth,
    ).toBeDefined();
    expect(documentResponse.body.paths['/auth/register']).toBeDefined();
    expect(documentResponse.body.paths['/auth/refresh']).toBeDefined();
    expect(documentResponse.body.paths['/trainers']).toBeDefined();
    for (const path of [
      '/trainings',
      '/trainings/{id}/content',
      '/sessions',
      '/payments',
      '/enrollments',
      '/progress',
      '/sessions/{id}/attendance',
      '/evaluations',
      '/certificates',
      '/invoices',
      '/feedback',
      '/costs/trainers',
      '/dashboard/overview',
      '/dashboard/financial',
      '/contact',
      '/trainings/{id}/thumbnail',
    ]) {
      expect(documentResponse.body.paths[path], path).toBeDefined();
    }
    expect(documentResponse.body.paths['/trainings'].get.parameters).toEqual(
      expect.arrayContaining([
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/PageSize' },
      ]),
    );
    expect(uiResponse.status).toBe(200);
    expect(uiResponse.text).toContain('Swagger UI');
  });

  it('rejects role injection before public registration reaches persistence', async () => {
    const response = await request(testApp()).post('/api/auth/register').send({
      email: 'attacker@example.com',
      password: 'a-secure-password',
      firstName: 'Ada',
      lastName: 'Lovelace',
      role: 'ADMIN',
    });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('protects user administration routes', async () => {
    const response = await request(testApp()).get('/api/users');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('validates and delivers public contact messages without exposing mail internals', async () => {
    const sendContactMessage = vi.fn().mockResolvedValue(undefined);
    const app = createApp({
      config: loadAppConfig(validEnvironment()),
      logger: pino({ level: 'silent' }),
      databaseReady: () => true,
      contactMailService: { sendContactMessage },
    });
    const valid = await request(app).post('/api/contact').send({
      name: 'Amira Ben Salah',
      email: 'amira@example.com',
      subject: 'Formation en présentiel',
      message: 'Je souhaite obtenir davantage d’informations.',
    });
    expect(valid.status).toBe(202);
    expect(valid.body.message).toBe('Votre message a bien été envoyé.');
    expect(sendContactMessage).toHaveBeenCalledOnce();

    const invalid = await request(app).post('/api/contact').send({
      name: 'A',
      email: 'invalide',
      subject: '',
      message: 'Court',
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns a safe French contact error when SMTP delivery fails', async () => {
    const app = createApp({
      config: loadAppConfig(validEnvironment()),
      logger: pino({ level: 'silent' }),
      databaseReady: () => true,
      contactMailService: {
        sendContactMessage: vi.fn().mockRejectedValue(new Error('SMTP secret')),
      },
    });
    const response = await request(app).post('/api/contact').send({
      name: 'Amira Ben Salah',
      email: 'amira@example.com',
      subject: 'Question',
      message: 'Voici une question suffisamment longue.',
    });
    expect(response.status).toBe(503);
    expect(response.body.error).toEqual({
      code: 'CONTACT_DELIVERY_FAILED',
      message:
        'Votre message n’a pas pu être envoyé pour le moment. Veuillez réessayer plus tard.',
    });
    expect(JSON.stringify(response.body)).not.toContain('SMTP secret');
  });

  it('rate-limits repeated login attempts before persistence', async () => {
    const app = testApp();
    const responses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      responses.push(await request(app).post('/api/auth/login').send({}));
    }

    expect(responses.slice(0, 10).every(({ status }) => status === 422)).toBe(
      true,
    );
    expect(responses[10]?.status).toBe(429);
    expect(responses[10]?.body.error.code).toBe('RATE_LIMITED');
    expect(responses[10]?.headers['retry-after']).toBeDefined();
  });

  it('uses the central error contract for unknown routes', async () => {
    const response = await request(testApp()).get('/not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested route does not exist.',
      },
      requestId: response.headers['x-request-id'],
    });
  });

  it('rejects malformed JSON without leaking parser internals', async () => {
    const response = await request(testApp())
      .post('/anything')
      .set('content-type', 'application/json')
      .send('{');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'MALFORMED_JSON',
        message: 'The request body is not valid JSON.',
      },
      requestId: response.headers['x-request-id'],
    });
  });
});

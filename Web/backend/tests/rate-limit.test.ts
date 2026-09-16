import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { rateLimit } from '../src/middleware/rate-limit.js';
import { AppError } from '../src/shared/errors/app-error.js';

function testApp(status: number) {
  const app = express();
  app.get(
    '/limited',
    rateLimit('test', 2, 60_000, { skipSuccessfulRequests: true }),
    (_request, response) => response.sendStatus(status),
  );
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof AppError) {
        response.status(error.status).json({ code: error.code });
        return;
      }
      response.sendStatus(500);
    },
  );
  return app;
}

describe('rateLimit', () => {
  it('does not count successful requests when configured for refresh traffic', async () => {
    const app = testApp(204);

    const responses = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      responses.push(await request(app).get('/limited'));
    }

    expect(responses.every(({ status }) => status === 204)).toBe(true);
  });

  it('continues to limit failed requests', async () => {
    const app = testApp(401);

    const responses = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      responses.push(await request(app).get('/limited'));
    }

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 429]);
    expect(responses[2]?.body.code).toBe('RATE_LIMITED');
  });
});

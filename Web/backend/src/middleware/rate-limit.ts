import type { RequestHandler } from 'express';

import { AppError } from '../shared/errors/app-error.js';

interface Counter {
  count: number;
  resetAt: number;
}

export function rateLimit(
  name: string,
  maximum: number,
  windowMs = 15 * 60_000,
): RequestHandler {
  const counters = new Map<string, Counter>();

  return (request, response, next) => {
    const now = Date.now();
    const key = `${name}:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
    const existing = counters.get(key);
    const counter =
      existing === undefined || existing.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : existing;
    counter.count += 1;
    counters.set(key, counter);

    if (counter.count > maximum) {
      response.setHeader(
        'retry-after',
        String(Math.ceil((counter.resetAt - now) / 1000)),
      );
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many requests. Try again later.',
        ),
      );
      return;
    }
    next();
  };
}

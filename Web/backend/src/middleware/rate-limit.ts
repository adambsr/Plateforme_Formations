import type { RequestHandler } from 'express';

import { AppError } from '../shared/errors/app-error.js';

interface Counter {
  count: number;
  resetAt: number;
}

const MAX_COUNTERS_PER_LIMITER = 10_000;

function pruneCounters(counters: Map<string, Counter>, now: number): void {
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key);
  }
  while (counters.size >= MAX_COUNTERS_PER_LIMITER) {
    const oldestKey = counters.keys().next().value as string | undefined;
    if (oldestKey === undefined) break;
    counters.delete(oldestKey);
  }
}

export function rateLimit(
  name: string,
  maximum: number,
  windowMs = 15 * 60_000,
): RequestHandler {
  const counters = new Map<string, Counter>();
  let requestCount = 0;

  return (request, response, next) => {
    const now = Date.now();
    const key = `${name}:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
    const existing = counters.get(key);
    requestCount += 1;
    if (
      requestCount % 1_000 === 0 ||
      (existing === undefined && counters.size >= MAX_COUNTERS_PER_LIMITER)
    ) {
      pruneCounters(counters, now);
    }
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

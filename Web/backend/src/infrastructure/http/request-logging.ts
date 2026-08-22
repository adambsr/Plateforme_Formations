import { randomUUID } from 'node:crypto';

import type { Logger } from 'pino';
import { type HttpLogger, pinoHttp } from 'pino-http';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function requestLogging(logger: Logger): HttpLogger {
  return pinoHttp({
    logger,
    genReqId(request, response) {
      const suppliedId = request.headers['x-request-id'];
      const requestId =
        typeof suppliedId === 'string' && REQUEST_ID_PATTERN.test(suppliedId)
          ? suppliedId
          : randomUUID();

      response.setHeader('x-request-id', requestId);
      return requestId;
    },
  });
}

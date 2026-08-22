import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { AppError, type FieldError } from '../../shared/errors/app-error.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: readonly FieldError[];
  };
  requestId: string;
}

function requestIdOf(request: Parameters<ErrorRequestHandler>[1]): string {
  return String(request.id ?? request.headers['x-request-id'] ?? 'unknown');
}

function isMalformedJson(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    (error as SyntaxError & { type?: string }).type === 'entity.parse.failed'
  );
}

function sendError(
  response: Parameters<ErrorRequestHandler>[2],
  status: number,
  body: ErrorBody,
): void {
  response.status(status).json(body);
}

export const notFoundHandler: RequestHandler = (request, response) => {
  sendError(response, 404, {
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested route does not exist.',
    },
    requestId: requestIdOf(request),
  });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  const requestId = requestIdOf(request);

  if (error instanceof AppError) {
    const errorPayload: ErrorBody['error'] = {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors === undefined
        ? {}
        : { fieldErrors: error.fieldErrors }),
    };
    sendError(response, error.status, { error: errorPayload, requestId });
    return;
  }

  if (error instanceof ZodError) {
    sendError(response, 422, {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'The request data is invalid.',
        fieldErrors: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      requestId,
    });
    return;
  }

  if (isMalformedJson(error)) {
    sendError(response, 400, {
      error: {
        code: 'MALFORMED_JSON',
        message: 'The request body is not valid JSON.',
      },
      requestId,
    });
    return;
  }

  request.log.error({ err: error }, 'Unhandled request error');
  sendError(response, 500, {
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    requestId,
  });
};

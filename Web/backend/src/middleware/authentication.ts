import type { RequestHandler } from 'express';

import type { TokenService } from '../modules/auth/services/token.service.js';
import { UserModel } from '../modules/users/models/user.model.js';
import { AppError } from '../shared/errors/app-error.js';
import type { UserRole } from '../modules/users/domain/user-role.js';

export function authenticate(tokenService: TokenService): RequestHandler {
  return async (request, _response, next) => {
    const authorization = request.headers.authorization;
    if (authorization === undefined || !authorization.startsWith('Bearer ')) {
      next(
        new AppError(
          401,
          'AUTHENTICATION_REQUIRED',
          'Authentication is required.',
        ),
      );
      return;
    }

    try {
      const tokenPrincipal = await tokenService.verifyAccessToken(
        authorization.slice(7),
      );
      const user = await UserModel.findById(tokenPrincipal.userId)
        .select({ role: 1, isActive: 1, mustChangePassword: 1 })
        .exec();
      if (user === null || !user.isActive) {
        next(
          new AppError(
            401,
            'ACCOUNT_UNAVAILABLE',
            'The account is unavailable.',
          ),
        );
        return;
      }
      request.principal = {
        userId: String(user._id),
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      };
      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }
      next(
        new AppError(
          401,
          'INVALID_ACCESS_TOKEN',
          'The access token is invalid or expired.',
        ),
      );
    }
  };
}

export function authenticateIfPresent(
  tokenService: TokenService,
): RequestHandler {
  const requiredAuthentication = authenticate(tokenService);
  return (request, response, next) => {
    if (request.headers.authorization === undefined) {
      next();
      return;
    }
    requiredAuthentication(request, response, next);
  };
}

export function requireRoles(...roles: readonly UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (
      request.principal === undefined ||
      !roles.includes(request.principal.role)
    ) {
      next(
        new AppError(
          403,
          'FORBIDDEN',
          'You are not authorized for this operation.',
        ),
      );
      return;
    }
    next();
  };
}

export const requirePasswordChanged: RequestHandler = (
  request,
  _response,
  next,
) => {
  if (request.principal?.mustChangePassword === true) {
    next(
      new AppError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'The temporary password must be changed before continuing.',
      ),
    );
    return;
  }
  next();
};

export function authenticatedPrincipal(request: Parameters<RequestHandler>[0]) {
  if (request.principal === undefined) {
    throw new AppError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication is required.',
    );
  }
  return request.principal;
}

import { Router, type Response } from 'express';

import type { AppConfig } from '../../../config/environment.js';
import {
  authenticate,
  authenticatedPrincipal,
  requirePasswordChanged,
} from '../../../middleware/authentication.js';
import { rateLimit } from '../../../middleware/rate-limit.js';
import type { UserService } from '../../users/services/user.service.js';
import { updateProfileSchema } from '../../users/dto/user.dto.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerLearnerSchema,
  resetPasswordSchema,
} from '../dto/auth.dto.js';
import type {
  AuthService,
  AuthSessionResult,
} from '../services/auth.service.js';
import type { TokenService } from '../services/token.service.js';

const REFRESH_COOKIE = 'refresh_token';

function cookieValue(
  header: string | undefined,
  name: string,
): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function setRefreshCookie(
  response: Response,
  result: AuthSessionResult,
  config: AppConfig,
): void {
  response.cookie(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure: config.application.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: Math.max(0, result.refreshExpiresAt.getTime() - Date.now()),
  });
}

function clearRefreshCookie(response: Response, config: AppConfig): void {
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.application.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

function sessionResponse(result: AuthSessionResult, client: 'WEB' | 'MOBILE') {
  return {
    accessToken: result.accessToken,
    user: result.user,
    ...(client === 'MOBILE' ? { refreshToken: result.refreshToken } : {}),
  };
}

export function createAuthRouter(
  config: AppConfig,
  authService: AuthService,
  userService: UserService,
  tokenService: TokenService,
): Router {
  const router = Router();

  router.post(
    '/register',
    rateLimit('register', 10),
    async (request, response) => {
      const input = registerLearnerSchema.parse(request.body);
      const result = await authService.registerLearner(input);
      if (input.client === 'WEB') setRefreshCookie(response, result, config);
      response.status(201).json(sessionResponse(result, input.client));
    },
  );

  router.post('/login', rateLimit('login', 10), async (request, response) => {
    const input = loginSchema.parse(request.body);
    const result = await authService.login(input);
    if (input.client === 'WEB') setRefreshCookie(response, result, config);
    response.json(sessionResponse(result, input.client));
  });

  router.post(
    '/refresh',
    rateLimit('refresh', 30),
    async (request, response) => {
      const input = refreshSchema.parse(request.body ?? {});
      const rawToken =
        input.client === 'WEB'
          ? cookieValue(request.headers.cookie, REFRESH_COOKIE)
          : input.refreshToken;
      if (rawToken === undefined) {
        response.status(401).json({
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'The refresh token is required.',
          },
          requestId: String(request.id),
        });
        return;
      }
      const result = await authService.refresh(rawToken);
      if (input.client === 'WEB') setRefreshCookie(response, result, config);
      response.json(sessionResponse(result, input.client));
    },
  );

  router.post('/logout', async (request, response) => {
    const input = logoutSchema.parse(request.body ?? {});
    const rawToken =
      input.client === 'WEB'
        ? cookieValue(request.headers.cookie, REFRESH_COOKIE)
        : input.refreshToken;
    await authService.logout(rawToken);
    if (input.client === 'WEB') clearRefreshCookie(response, config);
    response.status(204).send();
  });

  router.post(
    '/forgot-password',
    rateLimit('forgot-password', 5),
    async (request, response) => {
      const input = forgotPasswordSchema.parse(request.body);
      await authService.forgotPassword(input.email);
      response.status(202).json({
        message:
          'If an active account exists, password reset instructions have been sent.',
      });
    },
  );

  router.post(
    '/reset-password',
    rateLimit('reset-password', 10),
    async (request, response) => {
      const input = resetPasswordSchema.parse(request.body);
      await authService.resetPassword(input);
      clearRefreshCookie(response, config);
      response.status(204).send();
    },
  );

  router.post(
    '/change-password',
    authenticate(tokenService),
    async (request, response) => {
      const input = changePasswordSchema.parse(request.body);
      const result = await authService.changePassword(
        authenticatedPrincipal(request).userId,
        input,
      );
      if (input.client === 'WEB') setRefreshCookie(response, result, config);
      response.json(sessionResponse(result, input.client));
    },
  );

  router.get('/me', authenticate(tokenService), async (request, response) => {
    response.json(
      await authService.getMe(authenticatedPrincipal(request).userId),
    );
  });

  router.put(
    '/me',
    authenticate(tokenService),
    requirePasswordChanged,
    async (request, response) => {
      const input = updateProfileSchema.parse(request.body);
      response.json(
        await userService.updateProfile(
          authenticatedPrincipal(request).userId,
          input,
        ),
      );
    },
  );

  return router;
}

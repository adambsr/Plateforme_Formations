import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import type { AppConfig } from '../../../config/environment.js';
import { USER_ROLES, type UserRole } from '../../users/domain/user-role.js';

const JWT_ISSUER = 'plateforme-formations';
const JWT_AUDIENCE = 'plateforme-formations-clients';

export interface AccessTokenPrincipal {
  userId: string;
  role: UserRole;
}

export interface GeneratedRefreshToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export class TokenService {
  readonly #secret: Uint8Array;
  readonly #accessTtlMinutes: number;
  readonly #refreshTtlDays: number;

  constructor(config: AppConfig['authentication']) {
    this.#secret = new TextEncoder().encode(config.jwtAccessSecret);
    this.#accessTtlMinutes = config.jwtAccessTtlMinutes;
    this.#refreshTtlDays = config.refreshTokenTtlDays;
  }

  async createAccessToken(principal: AccessTokenPrincipal): Promise<string> {
    return new SignJWT({ role: principal.role, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(principal.userId)
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.#accessTtlMinutes}m`)
      .sign(this.#secret);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPrincipal> {
    const { payload } = await jwtVerify(token, this.#secret, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      !USER_ROLES.includes(payload.role as UserRole)
    ) {
      throw new Error('Invalid access token claims');
    }

    return { userId: payload.sub, role: payload.role as UserRole };
  }

  createRefreshToken(now = new Date()): GeneratedRefreshToken {
    const rawToken = randomBytes(48).toString('base64url');
    return {
      rawToken,
      tokenHash: this.hashOpaqueToken(rawToken),
      expiresAt: new Date(now.getTime() + this.#refreshTtlDays * 86_400_000),
    };
  }

  createPasswordResetToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(48).toString('base64url');
    return { rawToken, tokenHash: this.hashOpaqueToken(rawToken) };
  }

  hashOpaqueToken(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }
}

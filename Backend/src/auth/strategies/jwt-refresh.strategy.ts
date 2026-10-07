import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayloadType } from './types/jwt-refresh-payload.type';
import { OrNeverType } from '../../utils/types/or-never.type';
import { AllConfigType } from '../../config/config.type';
import { SessionService } from '../../session/session.service';
import { SessionExpiryService } from '../session-expiry.service';
import {
  extractTokenFromCookieNames,
  getAuthCookieNames,
  resolveAuthCookieScopeForRequest,
} from '../auth-cookie.util';
import type { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  private readonly logger = new Logger(JwtRefreshStrategy.name);

  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly sessionService: SessionService,
    private readonly sessionExpiryService: SessionExpiryService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) =>
          extractTokenFromCookieNames(
            request,
            getAuthCookieNames(
              'refresh',
              resolveAuthCookieScopeForRequest(configService, request),
            ),
          ) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: configService.getOrThrow('auth.refreshSecret', {
        infer: true,
      }),
    });
  }

  public async validate(
    payload: JwtRefreshPayloadType,
  ): Promise<OrNeverType<JwtRefreshPayloadType>> {
    if (!payload.sessionId) {
      this.logger.warn(
        'Rejecting refresh token payload due to missing sessionId',
      );
      throw new UnauthorizedException();
    }

    const session = await this.sessionService.findById(payload.sessionId);
    if (!session) {
      throw new UnauthorizedException('Session has been terminated');
    }

    const sessionActivityAt = session.lastActivityAt ?? session.updatedAt ?? session.createdAt;

    if (this.sessionExpiryService.isExpired(sessionActivityAt)) {
      this.logger.warn(
        `Refresh rejected: session expired for sessionId=${String(payload.sessionId)}`,
      );
      await this.sessionService.deleteById(session.id);
      throw new UnauthorizedException(
        'Session has expired. Please log in again.',
      );
    }

    void this.sessionService.touchActivity(session.id);

    return payload;
  }
}

import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { OrNeverType } from '../../utils/types/or-never.type';
import { JwtPayloadType } from './types/jwt-payload.type';
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
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

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
              'access',
              resolveAuthCookieScopeForRequest(configService, request),
            ),
          ) ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: configService.getOrThrow('auth.secret', { infer: true }),
    });
  }

  // Why we don't check if the user exists in the database:
  // https://github.com/brocoders/nestjs-boilerplate/blob/main/docs/auth.md#about-jwt-strategy
  public async validate(
    payload: JwtPayloadType,
  ): Promise<OrNeverType<JwtPayloadType>> {
    if (!payload.id || !payload.sessionId) {
      this.logger.warn(
        `Rejecting JWT payload due to missing id/sessionId (id=${String(payload?.id)}, sessionId=${String(payload?.sessionId)})`,
      );
      throw new UnauthorizedException();
    }

    const session = await this.sessionService.findById(payload.sessionId);
    if (!session) {
      this.logger.warn(
        `Session not found for sessionId=${String(payload.sessionId)}`,
      );
      throw new UnauthorizedException('Session has been terminated');
    }

    const sessionActivityAt = session.lastActivityAt ?? session.updatedAt ?? session.createdAt;

    if (this.sessionExpiryService.isExpired(sessionActivityAt)) {
      this.logger.warn(
        `Session expired by inactivity for sessionId=${String(payload.sessionId)} (${this.sessionExpiryService.getAgeMs(sessionActivityAt)}ms inactive)`,
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

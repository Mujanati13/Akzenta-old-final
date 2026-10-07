import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { SessionService } from '../session/session.service';
import { AllConfigType } from '../config/config.type';
import { isSessionExpired } from '../utils/session-timestamp.util';

@Injectable()
export class SessionCheckGuard implements CanActivate {
  private readonly maxSessionAgeMs: number;

  constructor(
    private sessionService: SessionService,
    private reflector: Reflector,
    configService: ConfigService<AllConfigType>,
  ) {
    const configured = configService.get('auth.sessionMaxAge', { infer: true });
    this.maxSessionAgeMs = ms((configured ?? '8h') as ms.StringValue);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sessionId) {
      return false;
    }

    const session = await this.sessionService.findById(user.sessionId);
    if (!session) {
      throw new UnauthorizedException('Session has been terminated');
    }

    const sessionActivityAt =
      session.lastActivityAt ?? session.updatedAt ?? session.createdAt;

    if (isSessionExpired(sessionActivityAt, this.maxSessionAgeMs)) {
      await this.sessionService.deleteById(session.id);
      throw new UnauthorizedException(
        'Session has expired. Please log in again.',
      );
    }

    void this.sessionService.touchActivity(session.id);

    return true;
  }
}

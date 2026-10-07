import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import {
  extractTokenFromCookieNames,
  getAuthCookieNames,
  resolveAuthCookieScopeForRequest,
} from '../auth/auth-cookie.util';

@Injectable()
export class OptionalJwtAuthGuard
  extends AuthGuard('jwt')
  implements CanActivate
{
  constructor(private readonly configService: ConfigService<AllConfigType>) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const bearerToken = request.headers['authorization']?.split(' ')[1];
    const cookieScope = resolveAuthCookieScopeForRequest(
      this.configService,
      request,
    );
    const cookieToken = extractTokenFromCookieNames(
      request,
      getAuthCookieNames('access', cookieScope),
    );
    const token = bearerToken || cookieToken;

    if (!token) {
      // If no token, allow request to continue (but without setting a user)
      return true;
    }

    // If there is a token, call the default AuthGuard to validate it
    const canActivate = (await super.canActivate(context)) as boolean;
    return canActivate;
  }

  handleRequest(err, user) {
    // If token is invalid or expired, user will be null
    if (err || !user) {
      return; // No user will be attached to the request, which means the request proceeds without a user
    }

    // If token is valid, the user will be attached to the request
    return user;
  }
}

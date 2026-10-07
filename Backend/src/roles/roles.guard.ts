import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { RoleEnum } from './roles.enum';

@Injectable()
export class RolesGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      throw new UnauthorizedException();
    }

    const roles = this.reflector.getAllAndOverride<(number | string)[]>(
      'roles',
      [context.getClass(), context.getHandler()],
    );

    if (!roles.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const roleId = request.user?.role?.id;
    let userRole =
      roleId != null && roleId !== ''
        ? String(roleId)
        : '';

    // JWT must carry role; if it is missing but userType is present (our access tokens),
    // treat as standard user for routes that only distinguish admin vs user.
    if (
      !userRole &&
      ['client', 'merchandiser', 'akzente'].includes(request.user?.userType)
    ) {
      userRole = String(RoleEnum.user);
    }

    if (!userRole || !roles.map(String).includes(userRole)) {
      this.logger.warn(
        `Role authorization failed for userId=${String(request.user?.id)} role=${String(userRole)} allowed=${roles
          .map(String)
          .join(',')}`,
      );
      throw new UnauthorizedException();
    }

    return true;
  }

  handleRequest(err, user) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}

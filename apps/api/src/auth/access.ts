import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, ROLES, type Permission, type Role } from '@plantify/contracts';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

const PUBLIC = 'access:public';
const OPTIONAL = 'access:optional';
const ROLES_KEY = 'access:roles';
const PERMISSION = 'access:permission';

/** Skips authentication (health, catalog browsing, ...). */
export const Public = () => SetMetadata(PUBLIC, true);
/** Like @Public(), but still fills `req.user` when a session exists (guest checkout). */
export const OptionalAuth = () => SetMetadata(OPTIONAL, true);
/** Allow only these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Allow only roles holding this permission (see packages/contracts). */
export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION, permission);

export type SessionUser = { id: string; email: string; name: string; role: Role };
export type AuthedRequest = Request & { user?: SessionUser };

/** Global guard: every route needs a session unless @Public(); @Roles / @RequirePermission narrow further. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const result = await this.authService.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) {
      if (this.reflector.getAllAndOverride<boolean>(OPTIONAL, targets)) return true;
      throw new UnauthorizedException();
    }

    const role = (ROLES as readonly string[]).includes((result.user as { role?: string }).role ?? '')
      ? ((result.user as { role: Role }).role)
      : 'customer';
    req.user = { id: result.user.id, email: result.user.email, name: result.user.name, role };

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(role)) throw new ForbiddenException();

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION, targets);
    if (permission && !can(role, permission)) throw new ForbiddenException();

    return true;
  }
}

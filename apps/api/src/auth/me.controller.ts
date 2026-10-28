import { Controller, Get, Req } from '@nestjs/common';
import { PERMISSIONS } from '@plantify/contracts';
import type { AuthedRequest } from './access.js';

@Controller('me')
export class MeController {
  /** Current user plus their permissions, so the UIs can hide what the API would refuse anyway. */
  @Get()
  me(@Req() req: AuthedRequest) {
    const user = req.user!;
    return { ...user, permissions: PERMISSIONS[user.role] };
  }
}

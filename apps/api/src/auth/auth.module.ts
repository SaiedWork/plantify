import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard, RateLimiter } from '../common/rate-limit.js';
import { MailModule } from '../mail/mail.module.js';
import { AccessGuard } from './access.js';
import { AuthService } from './auth.service.js';
import { MeController } from './me.controller.js';

@Global()
@Module({
  imports: [MailModule],
  controllers: [MeController],
  providers: [
    AuthService,
    RateLimiter,
    // Rate limiting runs before authentication so abusive callers are rejected cheaply.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthService, RateLimiter],
})
export class AuthModule {}

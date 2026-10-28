import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MailModule } from '../mail/mail.module.js';
import { AccessGuard } from './access.js';
import { AuthService } from './auth.service.js';
import { MeController } from './me.controller.js';

@Global()
@Module({
  imports: [MailModule],
  controllers: [MeController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AccessGuard }],
  exports: [AuthService],
})
export class AuthModule {}

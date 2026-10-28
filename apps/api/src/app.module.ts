import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { MailModule } from './mail/mail.module.js';

@Module({
  imports: [DbModule, MailModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}

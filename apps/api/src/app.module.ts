import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { MailModule } from './mail/mail.module.js';

@Module({
  imports: [DbModule, MailModule, AuthModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}

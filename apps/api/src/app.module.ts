import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { AddressesModule } from './addresses/addresses.module.js';
import { AuditModule } from './audit/audit.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { InternalModule } from './internal/internal.module.js';
import { MailModule } from './mail/mail.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [DbModule, AuditModule, MailModule, AuthModule, CatalogModule, CartModule, OrdersModule, AddressesModule, AdminModule, WebhooksModule, InternalModule],
  controllers: [HealthController],
})
export class AppModule {}

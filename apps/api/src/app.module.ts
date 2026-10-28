import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { CartModule } from './cart/cart.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';
import { MailModule } from './mail/mail.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [DbModule, MailModule, AuthModule, CatalogModule, CartModule, OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}

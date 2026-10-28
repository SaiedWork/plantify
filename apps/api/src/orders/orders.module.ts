import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module.js';
import { PaymentEventsService } from '../payments/payment-events.service.js';
import { MockPaymentProvider } from '../payments/mock-payment.provider.js';
import { WebhooksController } from '../payments/webhooks.controller.js';
import { CheckoutService } from './checkout.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [MailModule],
  controllers: [OrdersController, WebhooksController],
  providers: [CheckoutService, OrdersService, MockPaymentProvider, PaymentEventsService],
})
export class OrdersModule {}

import { Global, Module } from '@nestjs/common';
import { AdminWebhooksService } from './admin-webhooks.service.js';
import { WebhookDispatcher } from './webhook-dispatcher.service.js';
import { AdminWebhooksController, WebhookCronController } from './webhooks.controllers.js';

/** Global so checkout, payments and admin code can emit events without importing this module everywhere. */
@Global()
@Module({
  controllers: [AdminWebhooksController, WebhookCronController],
  providers: [WebhookDispatcher, AdminWebhooksService],
  exports: [WebhookDispatcher],
})
export class WebhooksModule {}

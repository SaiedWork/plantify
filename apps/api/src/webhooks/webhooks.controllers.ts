import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import {
  deliveryQuerySchema,
  webhookEndpointPatchSchema,
  webhookEndpointSchema,
  type DeliveryQuery,
  type WebhookEndpointInput,
} from '@plantify/contracts';
import { timingSafeEqual } from 'node:crypto';
import { Public, RequirePermission, type AuthedRequest } from '../auth/access.js';
import { ZodPipe } from '../common/zod-pipe.js';
import { requireEnv } from '../env.js';
import { AdminWebhooksService } from './admin-webhooks.service.js';
import { WebhookDispatcher } from './webhook-dispatcher.service.js';

@RequirePermission('webhooks:manage')
@Controller('admin/webhooks')
export class AdminWebhooksController {
  constructor(private readonly webhooks: AdminWebhooksService) {}

  @Get('endpoints')
  list() {
    return this.webhooks.listEndpoints();
  }

  @Post('endpoints')
  create(@Req() req: AuthedRequest, @Body(new ZodPipe(webhookEndpointSchema)) body: WebhookEndpointInput) {
    return this.webhooks.createEndpoint(req.user!.id, body);
  }

  @Patch('endpoints/:id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body(new ZodPipe(webhookEndpointPatchSchema)) body: Partial<WebhookEndpointInput>) {
    return this.webhooks.updateEndpoint(req.user!.id, id, body);
  }

  @Delete('endpoints/:id')
  @HttpCode(204)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.webhooks.removeEndpoint(req.user!.id, id);
  }

  @Post('endpoints/:id/test')
  @HttpCode(200)
  test(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.webhooks.test(req.user!.id, id);
  }

  @Get('deliveries')
  deliveries(@Query(new ZodPipe(deliveryQuerySchema)) query: DeliveryQuery) {
    return this.webhooks.listDeliveries(query);
  }

  @Post('deliveries/:id/retry')
  @HttpCode(200)
  retry(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.webhooks.retry(req.user!.id, id);
  }
}

/** Called by Vercel Cron (which sends `Authorization: Bearer $CRON_SECRET`). */
@Public()
@Controller('internal/webhooks')
export class WebhookCronController {
  constructor(private readonly dispatcher: WebhookDispatcher) {}

  @Post('retry')
  @HttpCode(200)
  async retry(@Headers('authorization') authorization?: string) {
    const expected = Buffer.from(`Bearer ${requireEnv('CRON_SECRET')}`);
    const given = Buffer.from(authorization ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException();
    return this.dispatcher.retryDue();
  }
}

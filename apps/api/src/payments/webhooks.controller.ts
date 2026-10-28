import { BadRequestException, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { SIGNATURE_HEADER, type PaymentEvent } from '@plantify/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../auth/access.js';
import { requireEnv } from '../env.js';
import { PaymentEventsService } from './payment-events.service.js';
import { verifySignature } from './signature.js';

const eventSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['payment.succeeded', 'payment.failed']),
  createdAt: z.string(),
  data: z.object({
    paymentId: z.string().min(1),
    orderId: z.string().min(1),
    failureReason: z.string().max(100).optional(),
  }),
});

@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly events: PaymentEventsService) {}

  @Post('payments')
  @HttpCode(200)
  async payments(@Req() req: Request & { rawBody?: Buffer }, @Headers(SIGNATURE_HEADER) signature?: string) {
    // The signature covers the exact bytes received, so verify before parsing anything.
    if (!verifySignature(req.rawBody, signature, requireEnv('PAYMENT_WEBHOOK_SECRET'))) {
      throw new UnauthorizedException('Invalid signature');
    }
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException('Malformed event');

    const result = await this.events.handle(parsed.data as PaymentEvent);
    return { received: true, result: result.status };
  }
}

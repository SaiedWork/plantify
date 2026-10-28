import { BadGatewayException, Injectable } from '@nestjs/common';
import { evaluateDemoCard, SIGNATURE_HEADER, type CardEvaluation, type CardInput, type PaymentEvent } from '@plantify/contracts';
import { requireEnv } from '../env.js';
import { signPayload } from './signature.js';

/**
 * "Plantify Pay": a stand-in for a payment processor. It decides the outcome of a demo card, then,
 * like a real processor, reports it asynchronously by POSTing a signed event to our webhook endpoint.
 */
@Injectable()
export class MockPaymentProvider {
  authorize(card: CardInput): CardEvaluation {
    return evaluateDemoCard(card);
  }

  async emit(type: PaymentEvent['type'], data: PaymentEvent['data']): Promise<void> {
    const event: PaymentEvent = { id: `evt_${crypto.randomUUID()}`, type, createdAt: new Date().toISOString(), data };
    const body = JSON.stringify(event);
    const base = process.env.PAYMENT_WEBHOOK_URL ?? process.env.API_URL ?? 'http://localhost:4000';

    const res = await fetch(`${base}/api/webhooks/payments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [SIGNATURE_HEADER]: signPayload(body, requireEnv('PAYMENT_WEBHOOK_SECRET')),
      },
      body,
    });
    if (!res.ok) throw new BadGatewayException(`Payment webhook was rejected (${res.status})`);
  }
}

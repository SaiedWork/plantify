import { createHmac, timingSafeEqual } from 'node:crypto';
import { SIGNATURE_TOLERANCE_SECONDS } from '@plantify/contracts';

const mac = (secret: string, timestamp: number, body: string | Buffer) =>
  createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');

/** Header value: `t=<unix seconds>,v1=<hex hmac of "<t>.<raw body>">` (Stripe-style). */
export function signPayload(body: string | Buffer, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${mac(secret, timestamp, body)}`;
}

export function verifySignature(
  body: Buffer | undefined,
  header: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!body || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || !parts.v1) return false;
  // Rejects replays of old captured requests.
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(mac(secret, timestamp, body));
  const given = Buffer.from(parts.v1);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

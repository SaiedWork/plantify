import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEMO_INBOX_COOKIE = 'demo_inbox';
const MAX_ADDRESSES = 5;

const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex');

/** Cookie value: `<email,email>.<hmac>`. Lets a browser read only the inboxes it triggered mail for. */
export function encodeInboxCookie(emails: string[], secret: string) {
  const value = encodeURIComponent(emails.slice(-MAX_ADDRESSES).join(','));
  return `${value}.${sign(value, secret)}`;
}

export function decodeInboxCookie(raw: string | undefined, secret: string): string[] {
  if (!raw) return [];
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return [];
  const value = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(value, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return [];
  return decodeURIComponent(value).split(',').filter(Boolean);
}

/** Returns the URL-decoded cookie value (cookie serializers percent-encode it on the way out). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  const raw = header
    ?.split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

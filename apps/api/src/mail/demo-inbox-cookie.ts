import { createHmac, timingSafeEqual } from 'node:crypto';

export const DEMO_INBOX_COOKIE = 'demo_inbox';
const MAX_ADDRESSES = 5;

const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('hex');

/**
 * One address this browser may read, and from when. `since` (epoch ms) keeps a new guest session from reading
 * mail that an earlier session left for the same address.
 */
export type InboxGrant = { email: string; since: number };

/** The mail that triggers a grant is written just before the grant, so the window opens a little earlier. */
const GRANT_SLACK_MS = 10_000;

/** Adds an address (keeping its original `since` when this browser already had it). */
export function withInboxGrant(current: InboxGrant[], email: string, now = Date.now()): InboxGrant[] {
  const normalized = email.toLowerCase();
  const since = current.find((g) => g.email === normalized)?.since ?? now - GRANT_SLACK_MS;
  return [...current.filter((g) => g.email !== normalized), { email: normalized, since }];
}

/** Guests get a session cookie (no expiry), so closing the browser forgets their inbox. */
export const INBOX_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

/** Cookie value: `<email|since,email|since>.<hmac>`. Lets a browser read only the inboxes it triggered mail for. */
export function encodeInboxCookie(grants: InboxGrant[], secret: string) {
  const value = encodeURIComponent(
    grants
      .slice(-MAX_ADDRESSES)
      .map((g) => `${g.email}|${g.since}`)
      .join(','),
  );
  return `${value}.${sign(value, secret)}`;
}

export function decodeInboxCookie(raw: string | undefined, secret: string): InboxGrant[] {
  if (!raw) return [];
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return [];
  const value = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(value, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return [];
  return decodeURIComponent(value)
    .split(',')
    .filter(Boolean)
    .map((entry) => {
      const [email = '', since] = entry.split('|');
      return { email, since: Number(since) || 0 };
    });
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

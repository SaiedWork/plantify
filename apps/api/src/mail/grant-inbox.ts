import type { Request, Response } from 'express';
import { requireEnv } from '../env.js';
import { DEMO_INBOX_COOKIE, decodeInboxCookie, encodeInboxCookie, readCookie } from './demo-inbox-cookie.js';

/** Lets the signed-in user's own browser read their demo inbox (e.g. order receipts). */
export function grantInbox(req: Request, res: Response, email: string) {
  const secret = requireEnv('BETTER_AUTH_SECRET');
  const normalized = email.toLowerCase();
  const current = decodeInboxCookie(readCookie(req.headers.cookie, DEMO_INBOX_COOKIE), secret);
  res.cookie(DEMO_INBOX_COOKIE, encodeInboxCookie([...current.filter((e) => e !== normalized), normalized], secret), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
}

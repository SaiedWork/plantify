import type { Request, Response } from 'express';
import { requireEnv } from '../env.js';
import {
  DEMO_INBOX_COOKIE,
  INBOX_COOKIE_OPTIONS,
  decodeInboxCookie,
  encodeInboxCookie,
  readCookie,
  withInboxGrant,
} from './demo-inbox-cookie.js';

/** Lets this browser read the demo inbox of an address it triggered mail for (e.g. order receipts). */
export function grantInbox(req: Request, res: Response, email: string) {
  const secret = requireEnv('BETTER_AUTH_SECRET');
  const current = decodeInboxCookie(readCookie(req.headers.cookie, DEMO_INBOX_COOKIE), secret);
  res.cookie(DEMO_INBOX_COOKIE, encodeInboxCookie(withInboxGrant(current, email), secret), INBOX_COOKIE_OPTIONS);
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ORDER_LINK_HOURS } from '@plantify/contracts';
import type { Request, Response } from 'express';
import { requireEnv } from '../env.js';
import { readCookie } from '../mail/demo-inbox-cookie.js';

/**
 * Guest checkout has no account, so a browser proves it owns an order in one of two ways:
 *  - a signed cookie listing the orders it created (lets it finish paying and see the success page), or
 *  - a signed, expiring link from the confirmation email (the public tracking page).
 */
export const GUEST_ORDERS_COOKIE = 'guest_orders';
const MAX_ORDERS = 5;

const sign = (value: string) => createHmac('sha256', requireEnv('BETTER_AUTH_SECRET')).update(value).digest('hex');

function matches(value: string, signature: string) {
  const given = Buffer.from(signature);
  const expected = Buffer.from(sign(value));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function readGuestOrderIds(req: Request): string[] {
  const raw = readCookie(req.headers.cookie, GUEST_ORDERS_COOKIE);
  const dot = raw?.lastIndexOf('.') ?? -1;
  if (!raw || dot < 0) return [];
  const value = raw.slice(0, dot);
  if (!matches(value, raw.slice(dot + 1))) return [];
  return value.split(',').filter(Boolean);
}

/** Remembers an order this browser created as a guest, until the browser closes (a session cookie). */
export function grantGuestOrder(req: Request, res: Response, orderId: string) {
  const ids = [...readGuestOrderIds(req).filter((id) => id !== orderId), orderId].slice(-MAX_ORDERS).join(',');
  res.cookie(GUEST_ORDERS_COOKIE, `${ids}.${sign(ids)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

/** Stateless "view your order" token: `<orderId>.<expiresAtMs>.<hmac>`. */
export function signOrderLink(orderId: string, now = Date.now()) {
  const expires = now + ORDER_LINK_HOURS * 60 * 60 * 1000;
  const value = `${orderId}.${expires}`;
  return { token: `${value}.${sign(value)}`, expiresAt: new Date(expires) };
}

export type OrderLink = { ok: true; orderId: string } | { ok: false; reason: 'invalid' | 'expired' };

export function verifyOrderLink(token: string, now = Date.now()): OrderLink {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'invalid' };
  const [orderId, expires, signature] = parts as [string, string, string];
  if (!matches(`${orderId}.${expires}`, signature)) return { ok: false, reason: 'invalid' };
  return Number(expires) > now ? { ok: true, orderId } : { ok: false, reason: 'expired' };
}

/** Absolute link when STOREFRONT_URL is set (Mailpit, real inboxes), otherwise relative (the in-app demo inbox). */
export function orderLinkUrl(orderId: string) {
  const { token, expiresAt } = signOrderLink(orderId);
  return { url: `${process.env.STOREFRONT_URL ?? ''}/orders/track/${token}`, expiresAt };
}

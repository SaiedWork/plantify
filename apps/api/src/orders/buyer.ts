import { sql, type SQL } from 'drizzle-orm';
import type { Request } from 'express';
import type { AuthedRequest } from '../auth/access.js';
import { readGuestOrderIds } from './guest-access.js';

/** Who is acting on an order: a signed-in customer, a guest holding order cookies, or both. */
export type Buyer = { userId: string | null; guestOrderIds: string[] };

export const buyerOf = (req: AuthedRequest): Buyer => ({ userId: req.user?.id ?? null, guestOrderIds: readGuestOrderIds(req as Request) });

/** SQL condition: the order (aliased `o`) belongs to this buyer. Guest cookies only ever match orders without an account. */
export function ownedBy(buyer: Buyer): SQL {
  const parts: SQL[] = [];
  if (buyer.userId) parts.push(sql`o.user_id = ${buyer.userId}`);
  if (buyer.guestOrderIds.length > 0) {
    parts.push(sql`(o.user_id is null and o.id in (${sql.join(buyer.guestOrderIds.map((id) => sql`${id}`), sql`, `)}))`);
  }
  return parts.length > 0 ? sql`(${sql.join(parts, sql` or `)})` : sql`false`;
}

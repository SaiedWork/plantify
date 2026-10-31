import { eq, sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { meta } from './schema/index.js';
import { seed } from './seed/seed.js';

/** Arbitrary key so concurrent resets (two cron runs, cron + manual) serialise on one lock. */
const RESET_LOCK = 8_147_001;

export async function getLastResetAt(db: Db): Promise<Date | null> {
  const [row] = await db.select({ value: meta.value }).from(meta).where(eq(meta.key, 'last_reset_at'));
  const date = row ? new Date(row.value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export type ResetOptions = {
  now?: Date;
  /** Skip (return null) unless this returns true for the stored `last_reset_at`; checked under the reset lock. */
  onlyIf?: (lastResetAt: Date | null) => boolean;
};

/**
 * Wipes every app table in one transaction and reseeds. The migrations table lives in the `drizzle` schema, so it is untouched.
 * Returns null when `onlyIf` says no reset is needed.
 */
export async function resetDatabase(db: Db, { now = new Date(), onlyIf }: ResetOptions = {}) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${RESET_LOCK})`);
    if (onlyIf && !onlyIf(await getLastResetAt(tx as unknown as Db))) return null;

    const { rows } = await tx.execute<{ tablename: string }>(
      sql`select tablename from pg_tables where schemaname = 'public'`,
    );
    if (rows.length > 0) {
      const names = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
      await tx.execute(sql.raw(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`));
    }
    return seed(tx as unknown as Db, now);
  });
}

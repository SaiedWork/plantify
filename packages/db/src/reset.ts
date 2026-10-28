import { sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { seed } from './seed/seed.js';

/** Wipes every app table in one transaction and reseeds. Migrations table lives in the `drizzle` schema, so it is untouched. */
export async function resetDatabase(db: Db, now = new Date()) {
  return db.transaction(async (tx) => {
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

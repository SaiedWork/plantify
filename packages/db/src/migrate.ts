import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

// Vercel build step: only the production deployment may touch the production database.
if (process.env.VERCEL && process.env.VERCEL_ENV !== 'production') {
  console.log(`skipping migrations on a ${process.env.VERCEL_ENV} deployment`);
  process.exit(0);
}

// Migrations need a direct (non-pooled) connection; Neon's Vercel integration exposes it as DATABASE_URL_UNPOOLED.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const pool = new pg.Pool({ connectionString: url });
await migrate(drizzle(pool), { migrationsFolder: new URL('../drizzle', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
await pool.end();
console.log('migrations applied');

import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import ws from 'ws';
import * as schema from './schema/index.js';

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

/**
 * Local Docker Postgres uses node-postgres; Neon hosts use the serverless
 * driver (websocket pool, so transactions still work on Vercel functions).
 */
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('DATABASE_URL is not set');

  if (new URL(url).hostname.endsWith('neon.tech')) {
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: url });
    return { db: drizzleNeon(pool, { schema }) as unknown as Db, close: () => pool.end() };
  }

  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzlePg(pool, { schema }), close: () => pool.end() };
}

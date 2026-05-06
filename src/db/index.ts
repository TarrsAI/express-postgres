import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

/**
 * Single shared pg.Pool. Tarrs sandbox provides Postgres locally so
 * the pool target is in-sandbox and latency is sub-ms; default pool
 * size of 10 is generous for a single-container app.
 *
 * If you point this at managed Postgres (RDS, Neon) over the public
 * internet, consider lowering the pool max + adding statement_timeout.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Crash slow queries before they wedge the pool. 30s is generous —
  // user-facing endpoints should never come close.
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 60_000,
});

export const db = drizzle(pool, { schema });

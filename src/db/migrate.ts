import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import { logger } from '../utility/logger.js';

/**
 * Standalone migration runner. Call from CI/deploy scripts via
 * `pnpm db:migrate`. Picks up every .sql file under drizzle/migrations
 * and applies them in order; drizzle's _drizzle_migrations table
 * records what's been applied so re-runs are idempotent.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, '..', '..', 'drizzle', 'migrations');

const main = async () => {
  logger.info({ migrationsFolder }, 'Applying migrations');
  await migrate(db, { migrationsFolder });
  logger.info('Migrations applied');
  await pool.end();
};

main().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});

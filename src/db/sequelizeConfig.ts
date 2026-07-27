import { Sequelize } from 'sequelize';
import logger from '../utility/logger.js';

/**
 * Runtime Sequelize instance. Single pool shared across the process.
 *
 * Pool sizing: the default of 10 is generous for a single-container
 * app talking to a sandbox-local Postgres (sub-ms latency). If you
 * point this at managed Postgres (RDS / Neon) over the public internet,
 * lower `max` and consider raising `acquire`.
 *
 * statement_timeout / idle_in_transaction_session_timeout guard
 * against slow queries wedging the pool — set as session-level GUCs
 * via `dialectOptions` so they apply to every connection.
 */
const useSsl = process.env.DATABASE_SSL === '1';

export const sequelize = new Sequelize(process.env.DATABASE_URL ?? '', {
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    idle: 10_000,
    acquire: 30_000,
  },
  dialectOptions: {
    statement_timeout: 30_000,
    idle_in_transaction_session_timeout: 60_000,
    // DATABASE_SSL is set precisely BECAUSE the link is untrusted —
    // managed Postgres over the public internet. `rejectUnauthorized:
    // false` then turns TLS on and declines to check who is on the other
    // end, which is the one thing it was turned on for. Verify by
    // default; DATABASE_SSL_INSECURE=1 is an explicit, named opt-out for
    // a local self-signed setup.
    ...(useSsl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: process.env.DATABASE_SSL_INSECURE !== '1',
          },
        }
      : {}),
  },
});

/**
 * Boot-time connectivity check. Crashes the process if the pool can't
 * reach Postgres — better to fail loud at startup than to serve 500s
 * once the first request lands.
 *
 * NOTE: we deliberately do NOT call `sync()` here. Schema lives in
 * sequelize-cli migrations under `migrations/`, run via `pnpm db:migrate`
 * before boot. `sync()` would diverge from migration state and corrupt
 * production.
 */
export const db = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Postgres connected');
  } catch (err) {
    logger.fatal({ err }, 'Postgres unreachable — refusing to start');
    process.exit(1);
  }
};

export default sequelize;

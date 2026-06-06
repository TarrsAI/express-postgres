'use strict';

// sequelize-cli config. Has to be CJS because the CLI doesn't go
// through tsx and won't load an ESM/TS module. Identical shape
// across all envs — DATABASE_URL is the single source of truth.
//
// Production: same connection string the runtime uses, but with
// SSL enabled when DATABASE_SSL=1 (managed Postgres providers like
// RDS/Neon require it).

require('dotenv').config();

const useSsl = process.env.DATABASE_SSL === '1';
const dialectOptions = useSsl
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {};

const base = {
  url: process.env.DATABASE_URL,
  dialect: 'postgres',
  logging: false,
  dialectOptions,
};

module.exports = {
  development: base,
  test: base,
  production: base,
};

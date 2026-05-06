import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // drizzle-kit reads this only at generate / migrate time on the
    // dev machine. Runtime uses src/db/index.ts which has its own
    // env validation.
    url: process.env.DATABASE_URL ?? '',
  },
  // Names the schema_migrations table drizzle uses internally — keeps
  // it out of the way if you ever browse the public schema in psql.
  migrations: { table: '_drizzle_migrations', schema: 'public' },
});

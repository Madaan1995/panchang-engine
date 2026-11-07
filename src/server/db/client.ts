/** Postgres connection pool + Drizzle instance, configured from DATABASE_URL. */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') throw new Error('DATABASE_URL is not set (see .env.example)');
  return url;
}

export function createDb(url = databaseUrl()): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), pool };
}

/**
 * Integration test of PgStore against a real Postgres. Requires
 * DATABASE_URL_TEST (see .env.example); run with `npm run test:db`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, type Database } from '@/server/db/client';
import { generateApiKey } from '@/server/keys';
import { PgStore } from '@/server/pgStore';
import type { Pool } from 'pg';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.DATABASE_URL_TEST;
if (url === undefined || url === '') throw new Error('DATABASE_URL_TEST must be set for npm run test:db');

let db: Database;
let pool: Pool;

beforeAll(async () => {
  ({ db, pool } = createDb(url));
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  await migrate(db, { migrationsFolder: './drizzle' });
});

afterAll(async () => {
  await pool.end();
});

describe('PgStore (Postgres integration)', () => {
  it('creates a key storing only its hash and finds it by hash', async () => {
    const store = new PgStore(db);
    const key = generateApiKey();
    const created = await store.create({ name: 'test', keyPrefix: key.prefix, keyHash: key.hash, plan: 'free' });
    expect(created.id).toBeGreaterThan(0);
    expect((await store.findByHash(key.hash))?.name).toBe('test');
    const raw = await db.execute(sql`SELECT * FROM api_keys`);
    expect(JSON.stringify(raw.rows)).not.toContain(key.plaintext);
  });

  it('records usage and counts only billable (status < 400) events since a cutoff', async () => {
    const store = new PgStore(db);
    const key = generateApiKey();
    const k = await store.create({ name: 'usage', keyPrefix: key.prefix, keyHash: key.hash, plan: 'free' });
    const t0 = new Date(Date.UTC(2026, 10, 1));
    await store.record({ apiKeyId: k.id, endpoint: '/api/v1/panchang', status: 200, createdAt: new Date(t0.getTime() - 1000) });
    await store.record({ apiKeyId: k.id, endpoint: '/api/v1/panchang', status: 200, createdAt: t0 });
    await store.record({ apiKeyId: k.id, endpoint: '/api/v1/panchang', status: 400, createdAt: t0 });
    await store.record({ apiKeyId: k.id, endpoint: '/api/v1/festivals', status: 200, createdAt: new Date(t0.getTime() + 1000) });
    expect(await store.countBillableSince(k.id, t0)).toBe(2);
  });
});

/**
 * Production wiring: Postgres-backed stores, mock billing and the real clock.
 * The pool is cached on globalThis so Next.js hot reloads don't leak
 * connections.
 */
import type { ApiDeps } from './api';
import { MockBillingProvider } from './billing';
import { createDb } from './db/client';
import { PgStore } from './pgStore';

const globalForDeps = globalThis as unknown as { __panchangDeps?: ApiDeps };

export function productionDeps(): ApiDeps {
  if (globalForDeps.__panchangDeps === undefined) {
    const { db } = createDb();
    const store = new PgStore(db);
    globalForDeps.__panchangDeps = { keys: store, usage: store, billing: new MockBillingProvider(), now: () => new Date() };
  }
  return globalForDeps.__panchangDeps;
}

/**
 * Database schema (Drizzle ORM). This file is the source for migrations:
 * after changing it run `npm run db:generate`, which writes a new SQL file to
 * drizzle/. Never edit the database by hand; always add a migration.
 */
import { bigserial, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

/** API keys. Only a SHA-256 hash of the key is stored, never the key itself. */
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  /** Human label, e.g. "PurohitDesk production". */
  name: text('name').notNull(),
  /** First characters of the key (e.g. "pk_live_ab12"), safe to show in logs and dashboards. */
  keyPrefix: text('key_prefix').notNull(),
  /** Hex SHA-256 of the full key. */
  keyHash: text('key_hash').notNull().unique(),
  /** Billing plan name; the BillingProvider maps it to a monthly quota. */
  plan: text('plan').notNull().default('free'),
  /** Optional per-key override of the plan's monthly quota. */
  monthlyQuotaOverride: integer('monthly_quota_override'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

/** One row per authenticated API call (metering). */
export const usageEvents = pgTable(
  'usage_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    apiKeyId: integer('api_key_id')
      .notNull()
      .references(() => apiKeys.id),
    endpoint: text('endpoint').notNull(),
    status: integer('status').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('usage_events_key_time_idx').on(t.apiKeyId, t.createdAt)],
);

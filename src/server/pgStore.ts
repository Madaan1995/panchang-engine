/** Postgres implementation of KeyStore and UsageStore (Drizzle ORM). */
import { and, count, eq, gte, lt } from 'drizzle-orm';
import type { Database } from './db/client';
import { apiKeys, usageEvents } from './db/schema';
import type { ApiKeyRecord, KeyStore, NewApiKey, UsageEvent, UsageStore } from './store';

export class PgStore implements KeyStore, UsageStore {
  constructor(private readonly db: Database) {}

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const rows = await this.db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
    return rows[0] ?? null;
  }

  async create(key: NewApiKey): Promise<ApiKeyRecord> {
    const rows = await this.db
      .insert(apiKeys)
      .values({ ...key, monthlyQuotaOverride: key.monthlyQuotaOverride ?? null })
      .returning();
    return rows[0] as ApiKeyRecord;
  }

  async record(event: UsageEvent): Promise<void> {
    await this.db.insert(usageEvents).values(event);
  }

  async countBillableSince(apiKeyId: number, since: Date): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(usageEvents)
      .where(and(eq(usageEvents.apiKeyId, apiKeyId), gte(usageEvents.createdAt, since), lt(usageEvents.status, 400)));
    return Number(rows[0]?.n ?? 0);
  }
}

/**
 * Storage interfaces for API keys and usage metering. The HTTP handlers only
 * depend on these interfaces, so tests use the in-memory implementation and
 * production uses Postgres (pgStore.ts).
 */
export interface ApiKeyRecord {
  id: number;
  name: string;
  keyPrefix: string;
  keyHash: string;
  plan: string;
  monthlyQuotaOverride: number | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface NewApiKey {
  name: string;
  keyPrefix: string;
  keyHash: string;
  plan: string;
  monthlyQuotaOverride?: number | null;
}

export interface KeyStore {
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  create(key: NewApiKey): Promise<ApiKeyRecord>;
}

export interface UsageEvent {
  apiKeyId: number;
  endpoint: string;
  status: number;
  createdAt: Date;
}

export interface UsageStore {
  record(event: UsageEvent): Promise<void>;
  /** Calls by a key at or after `since` that count toward quota (status < 400). */
  countBillableSince(apiKeyId: number, since: Date): Promise<number>;
}

/** In-memory implementation for tests and local experiments. */
export class MemoryStore implements KeyStore, UsageStore {
  keys: ApiKeyRecord[] = [];
  events: UsageEvent[] = [];

  async findByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    return this.keys.find((k) => k.keyHash === keyHash) ?? null;
  }

  async create(key: NewApiKey): Promise<ApiKeyRecord> {
    const record: ApiKeyRecord = {
      id: this.keys.length + 1,
      name: key.name,
      keyPrefix: key.keyPrefix,
      keyHash: key.keyHash,
      plan: key.plan,
      monthlyQuotaOverride: key.monthlyQuotaOverride ?? null,
      createdAt: new Date(0),
      revokedAt: null,
    };
    this.keys.push(record);
    return record;
  }

  async record(event: UsageEvent): Promise<void> {
    this.events.push(event);
  }

  async countBillableSince(apiKeyId: number, since: Date): Promise<number> {
    return this.events.filter((e) => e.apiKeyId === apiKeyId && e.createdAt >= since && e.status < 400).length;
  }
}

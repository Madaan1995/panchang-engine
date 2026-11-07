import { describe, expect, it } from 'vitest';
import { MockBillingProvider } from '@/server/billing';
import { checkQuota, quotaFor, startOfNextUtcMonth, startOfUtcMonth } from '@/server/metering';
import { MemoryStore } from '@/server/store';

const NOW = new Date(Date.UTC(2026, 10, 15, 12));

async function keyWith(plan: string, override: number | null = null) {
  const store = new MemoryStore();
  const key = await store.create({ name: 'k', keyPrefix: 'pk_live_xxxx', keyHash: 'ab'.repeat(32), plan, monthlyQuotaOverride: override });
  return { store, key };
}

describe('BillingProvider mock', () => {
  it('assigns a fixed quota per plan name and null for unknown plans', () => {
    const b = new MockBillingProvider();
    expect(b.monthlyQuota('free')).toBeGreaterThan(0);
    expect(b.monthlyQuota('pro')!).toBeGreaterThan(b.monthlyQuota('free')!);
    expect(b.monthlyQuota('platinum')).toBeNull();
    expect(b.monthlyQuota('toString')).toBeNull();
  });
});

describe('monthly quota', () => {
  const billing = new MockBillingProvider({ free: 3 });

  it('month boundaries are UTC calendar months', () => {
    expect(startOfUtcMonth(NOW).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(startOfNextUtcMonth(new Date(Date.UTC(2026, 11, 31, 23))).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('allows calls until the plan quota is used, then refuses with a clear message', async () => {
    const { store, key } = await keyWith('free');
    for (let i = 0; i < 3; i++) {
      expect((await checkQuota(key, store, billing, NOW)).allowed).toBe(true);
      await store.record({ apiKeyId: key.id, endpoint: '/x', status: 200, createdAt: NOW });
    }
    const s = await checkQuota(key, store, billing, NOW);
    expect(s.allowed).toBe(false);
    expect(s.message).toMatch(/Monthly quota exceeded: 3 of 3 calls/);
    expect(s.message).toMatch(/2026-12-01T00:00:00.000Z/);
  });

  it('only successful calls count, and last month\'s calls do not', async () => {
    const { store, key } = await keyWith('free');
    await store.record({ apiKeyId: key.id, endpoint: '/x', status: 400, createdAt: NOW });
    await store.record({ apiKeyId: key.id, endpoint: '/x', status: 429, createdAt: NOW });
    await store.record({ apiKeyId: key.id, endpoint: '/x', status: 200, createdAt: new Date(Date.UTC(2026, 9, 31, 23)) });
    const s = await checkQuota(key, store, billing, NOW);
    expect(s.used).toBe(0);
    expect(s.allowed).toBe(true);
  });

  it('a per-key override beats the plan quota; unknown plans get 0', async () => {
    const { key } = await keyWith('free', 10);
    expect(quotaFor(key, billing)).toBe(10);
    const { key: k2 } = await keyWith('mystery');
    expect(quotaFor(k2, billing)).toBe(0);
  });
});

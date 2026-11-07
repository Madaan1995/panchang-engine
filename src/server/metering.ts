/**
 * Usage metering and monthly quotas.
 *
 * Every authenticated call appends a usage row (key, endpoint, timestamp,
 * HTTP status) — including calls that fail validation or exceed quota, so the
 * log is complete. Only successful calls (status < 400) count toward quota.
 * Quota months are UTC calendar months, so every customer's counter resets at
 * the same moment regardless of their timezone.
 */
import type { BillingProvider } from './billing';
import type { ApiKeyRecord, UsageStore } from './store';

export function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function startOfNextUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface QuotaStatus {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: Date;
  message?: string;
}

export function quotaFor(key: ApiKeyRecord, billing: BillingProvider): number {
  return key.monthlyQuotaOverride ?? billing.monthlyQuota(key.plan) ?? 0;
}

export async function checkQuota(key: ApiKeyRecord, usage: UsageStore, billing: BillingProvider, now: Date): Promise<QuotaStatus> {
  const limit = quotaFor(key, billing);
  const used = await usage.countBillableSince(key.id, startOfUtcMonth(now));
  const resetsAt = startOfNextUtcMonth(now);
  const allowed = used < limit;
  return {
    allowed,
    limit,
    used,
    remaining: Math.max(0, limit - used - (allowed ? 1 : 0)),
    resetsAt,
    ...(allowed
      ? {}
      : {
          message:
            `Monthly quota exceeded: ${used} of ${limit} calls used this month on plan '${key.plan}'. ` +
            `The quota resets at ${resetsAt.toISOString()}. Contact us to upgrade your plan.`,
        }),
  };
}

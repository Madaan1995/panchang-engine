/**
 * Billing is stubbed behind an interface (SPEC: "External services").
 * A real implementation would ask Stripe which plan a customer is on; the mock
 * assigns a fixed monthly quota per plan name.
 */
export interface BillingProvider {
  /** Monthly call quota for a plan, or null if the plan is unknown. */
  monthlyQuota(plan: string): number | null;
  knownPlans(): string[];
}

/** Fixed quotas per plan. Numbers are placeholders for the human to set. */
export const MOCK_PLAN_QUOTAS: Readonly<Record<string, number>> = {
  free: 1_000,
  starter: 50_000,
  pro: 500_000,
};

export class MockBillingProvider implements BillingProvider {
  constructor(private readonly quotas: Readonly<Record<string, number>> = MOCK_PLAN_QUOTAS) {}

  monthlyQuota(plan: string): number | null {
    return Object.hasOwn(this.quotas, plan) ? (this.quotas[plan] as number) : null;
  }

  knownPlans(): string[] {
    return Object.keys(this.quotas);
  }
}

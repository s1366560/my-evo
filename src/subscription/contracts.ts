import type { BillingCycle, Plan, PlanId } from './plans';
import { ValidationError } from '../shared/errors';

const PLAN_ALIASES: Record<string, PlanId> = {
  pro: 'premium',
  team: 'premium',
  enterprise: 'ultra',
};

const BILLING_CYCLE_ALIASES: Record<string, BillingCycle> = {
  yearly: 'annual',
};

const VALID_PLAN_IDS = new Set<PlanId>(['free', 'premium', 'ultra']);
const VALID_BILLING_CYCLES = new Set<BillingCycle>(['monthly', 'annual']);

export function normalizePlanId(plan?: string): PlanId {
  const normalized = (plan ?? 'free').toLowerCase();
  const mapped = PLAN_ALIASES[normalized] ?? normalized;
  if (!VALID_PLAN_IDS.has(mapped as PlanId)) {
    throw new ValidationError('Invalid plan. Must be one of: free, premium, ultra');
  }

  return mapped as PlanId;
}

export function normalizeBillingCycle(billingCycle?: string): BillingCycle {
  const normalized = (billingCycle ?? 'monthly').toLowerCase();
  const mapped = BILLING_CYCLE_ALIASES[normalized] ?? normalized;
  if (!VALID_BILLING_CYCLES.has(mapped as BillingCycle)) {
    throw new ValidationError('Invalid billing_cycle. Must be monthly or annual');
  }

  return mapped as BillingCycle;
}

export function serializePlan(plan: Plan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    monthly_credits: plan.price_monthly_credits,
    annual_credits: plan.price_annual_credits,
    features: plan.features,
    limits: plan.limits,
  };
}

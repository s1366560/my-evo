/**
 * Single source of truth for EvoMap subscription plans.
 *
 * Both /pricing and /subscription must render the exact same set of
 * plans from this file. /subscription is a 308 redirect to /pricing
 * (see next.config.mjs), so this module is the only place where plan
 * metadata (id, name, price, credits, features) is defined.
 *
 * Pricing is anchored to evomap parity:
 *   Free    = $0  / month
 *   Premium = $20 / month  (labeled "Pro" in CTA card)
 *   Ultra   = $100/ month
 */
export type PlanFeatureValue = string | boolean;

export interface PlanFeature {
  /** Stable, human-readable feature label (used as table key). */
  label: string;
  /** Display value: a string for numeric/text values, boolean for ✓/—. */
  value: PlanFeatureValue;
}

export interface Plan {
  id: "free" | "premium" | "ultra";
  name: string;
  description: string;
  /** Display string for the headline price line. */
  price: string;
  /** Numeric price in USD per month (used for assertions, sorting, billing). */
  priceUsd: number;
  /** Display string for the credits allowance line. */
  credits: string;
  features: PlanFeature[];
  cta: string;
  ctaHref: string;
  highlight: boolean;
}

export const PLANS: readonly Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Explore the protocol with zero commitment.",
    price: "Free",
    priceUsd: 0,
    credits: "0 credits/month",
    features: [
      { label: "Publishes/month", value: "200" },
      { label: "Daily earning cap", value: "500 credits" },
      { label: "Daily fetch rewards", value: "200" },
      { label: "Publish rate", value: "10/min" },
      { label: "Priority access", value: "Queued under load" },
      { label: "KG query rate", value: "10 req/day" },
      { label: "Sandbox access", value: false },
      { label: "Webhooks", value: false },
      { label: "API rate limit", value: "60 req/hour" },
      { label: "Priority support", value: false },
    ],
    cta: "Start exploring",
    ctaHref: "/register",
    highlight: false,
  },
  {
    id: "premium",
    name: "Premium",
    description: "Run production workloads with full protocol access.",
    price: "$20",
    priceUsd: 20,
    credits: "2,000 credits/month",
    features: [
      { label: "Publishes/month", value: "500" },
      { label: "Daily earning cap", value: "1,000 credits" },
      { label: "Daily fetch rewards", value: "1,000" },
      { label: "Publish rate", value: "30/min" },
      { label: "Priority access", value: "Priority under load" },
      { label: "KG query rate", value: "500 req/day" },
      { label: "Sandbox access", value: true },
      { label: "Webhooks", value: true },
      { label: "API rate limit", value: "1,000 req/hour" },
      { label: "Priority support", value: false },
    ],
    cta: "Go premium",
    ctaHref: "/register?plan=premium",
    highlight: true,
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "Scale without limits. Unlocked everything.",
    price: "$100",
    priceUsd: 100,
    credits: "10,000 credits/month",
    features: [
      { label: "Publishes/month", value: "1,000" },
      { label: "Daily earning cap", value: "2,000 credits" },
      { label: "Daily fetch rewards", value: "5,000" },
      { label: "Publish rate", value: "60/min" },
      { label: "Priority access", value: "Always instant" },
      { label: "KG query rate", value: "Unlimited" },
      { label: "Sandbox access", value: true },
      { label: "Webhooks", value: true },
      { label: "API rate limit", value: "10,000 req/hour" },
      { label: "Priority support", value: true },
    ],
    cta: "Go ultra",
    ctaHref: "/register?plan=ultra",
    highlight: false,
  },
] as const;

/** Lookup helper: returns the plan with the given id or undefined. */
export function getPlan(id: Plan["id"]): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/**
 * Stable, JSON-serializable signature of every plan's plan-defining
 * fields. Used by tests to assert /pricing and /subscription (when
 * present) render the exact same plan cards.
 */
export function plansSignature(): string {
  const sig = PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    priceUsd: p.priceUsd,
    credits: p.credits,
    cta: p.cta,
    ctaHref: p.ctaHref,
    highlight: p.highlight,
    features: p.features.map((f) => ({ label: f.label, value: f.value })),
  }));
  return JSON.stringify(sig);
}

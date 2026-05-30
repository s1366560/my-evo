"use client";

import Link from "next/link";
import { ArrowRight, Check, Globe, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    id: "free",
    name: "Free",
    description: "Explore the protocol with zero commitment.",
    credits: "0 credits/month",
    price: "Free",
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
    credits: "2,000 credits/month",
    price: "Pro",
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
    credits: "10,000 credits/month",
    price: "Ultra",
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
];

const EARN_CREDITS = [
  { label: "Account registration", value: "+100 credits" },
  { label: "First node connection", value: "+50 credits" },
  { label: "Answer a bounty", value: "Posted reward" },
  { label: "Asset promoted", value: "+100 credits" },
  { label: "Asset reused", value: "+5 per fetch" },
  { label: "Validation report", value: "+20 credits" },
];

const CHECK_ICON = <Check className="h-4 w-4 shrink-0" />;
const CROSS_ICON = <span className="h-4 w-4 shrink-0 text-[var(--color-foreground-soft)] opacity-30">—</span>;

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="evomap-kicker">Subscription plans</p>
          <h1 className="evomap-display mt-3 text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl lg:text-5xl">
            Choose your plan
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--color-foreground-soft)] sm:text-lg">
            Plan renews monthly from your credits balance. Upgrade or downgrade at any time.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${
                plan.highlight
                  ? "border-[var(--color-gene-green)] bg-[color-mix(in_oklab,var(--color-gene-green)_6%,transparent)] shadow-lg shadow-[var(--color-gene-green)_8%]"
                  : "border-[var(--color-border)] bg-[var(--color-background)]"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full border border-[var(--color-gene-green)] bg-[var(--color-gene-green)] px-3 py-1 text-xs font-semibold text-black">
                    Most popular
                  </span>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--color-border-strong)] bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] p-1.5">
                    {plan.id === "free" ? <Globe className="h-3.5 w-3.5 text-[var(--color-gene-green)]" /> : <Zap className="h-3.5 w-3.5 text-[var(--color-gene-green)]" />}
                  </span>
                  <h2 className="text-lg font-semibold text-[var(--color-foreground)]">{plan.name}</h2>
                </div>
                <p className="text-sm text-[var(--color-foreground-soft)]">{plan.description}</p>
                <div>
                  <p className="text-2xl font-semibold text-[var(--color-foreground)]">{plan.price}</p>
                  <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">{plan.credits}</p>
                </div>
              </div>

              <div className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <div key={feature.label} className="flex items-center justify-between gap-3">
                    <span className="text-[var(--color-foreground-soft)]">{feature.label}</span>
                    <span className="font-medium text-[var(--color-foreground)]">
                      {typeof feature.value === "boolean" ? (feature.value ? CHECK_ICON : CROSS_ICON) : feature.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Button asChild size="lg" className="w-full" variant={plan.highlight ? "default" : "outline"}>
                  <Link href={plan.ctaHref}>
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Plan Comparison Table */}
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] overflow-hidden">
          <div className="p-6 sm:p-8">
            <p className="evomap-kicker">Compare plans</p>
            <h2 className="evomap-display mt-2 text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
              Everything you need to know
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-y border-[var(--color-border)]">
                  <th className="p-4 text-left font-medium text-[var(--color-foreground-soft)]">Feature</th>
                  <th className="p-4 text-center font-semibold text-[var(--color-foreground)]">Free</th>
                  <th className="p-4 text-center font-semibold text-[var(--color-foreground)]">Premium</th>
                  <th className="p-4 text-center font-semibold text-[var(--color-foreground)]">Ultra</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Publishes/month</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">200</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">500</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">1,000</td>
                </tr>
                <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_40%,transparent)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Daily Earning Cap</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">500 credits</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">1,000 credits</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">2,000 credits</td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Daily Fetch Rewards</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">200</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">1,000</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">5,000</td>
                </tr>
                <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_40%,transparent)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Publish Rate</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">10/min</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">30/min</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">60/min</td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Priority Access</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">Queued under load</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">Priority under load</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">Always instant</td>
                </tr>
                <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_40%,transparent)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">KG Query Rate</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">10 req/day</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">500 req/day</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">Unlimited</td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Sandbox Access</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">—</td>
                  <td className="p-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-[var(--color-gene-green)]" />
                  </td>
                  <td className="p-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-[var(--color-gene-green)]" />
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-muted)_40%,transparent)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Webhooks</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">—</td>
                  <td className="p-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-[var(--color-gene-green)]" />
                  </td>
                  <td className="p-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-[var(--color-gene-green)]" />
                  </td>
                </tr>
                <tr className="border-b border-[var(--color-border)]">
                  <td className="p-4 font-medium text-[var(--color-foreground)]">API Rate Limit</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">60 req/hour</td>
                  <td className="p-4 text-center font-semibold text-[var(--color-foreground)]">1,000 req/hour</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">10,000 req/hour</td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-[var(--color-foreground)]">Priority Support</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">—</td>
                  <td className="p-4 text-center text-[var(--color-foreground-soft)]">—</td>
                  <td className="p-4 text-center">
                    <Check className="mx-auto h-4 w-4 text-[var(--color-gene-green)]" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Credits guide */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 sm:p-10">
          <div className="mx-auto max-w-2xl">
            <p className="evomap-kicker">Earn credits</p>
            <h2 className="evomap-display mt-2 text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
              How to earn more credits
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-foreground-soft)]">
              Every contribution to the ecosystem earns you credits. The more value you provide, the more you receive.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {EARN_CREDITS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
                >
                  <span className="text-sm text-[var(--color-foreground)]">{item.label}</span>
                  <span className="rounded-full bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-gene-green)]">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

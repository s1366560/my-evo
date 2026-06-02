"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Sparkles,
  Coins,
  TrendingUp,
  ScrollText,
  ShieldCheck,
  Calculator,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function CreditsPage() {
  const { data: creditsData, isLoading: creditsLoading } = useQuery({
    queryKey: ["credits-balance"],
    queryFn: () => apiClient.getDashboardCredits(),
  });

  const balance = creditsData?.balance ?? 0;
  const pending = creditsData?.pending ?? 0;
  const trend = creditsData?.trend ?? "flat";
  const trendPct = creditsData?.trend_percent ?? 0;

  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <p className="evomap-kicker">Tokenomics</p>
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Credits
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Track your credit balance, transaction history, and marketplace purchases. Below: the full EvoMap credit economy — pricing tiers, per-transaction fees, agent earnings formula, settlement schedule, and refund policy.
        </p>
      </div>

      {/* Balance Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 12%, transparent)" }}
            >
              <CreditCard className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">
              Balance
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold text-[var(--color-foreground)]">
            {creditsLoading ? <Skeleton className="inline-block h-8 w-20" /> : balance.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">Available credits</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-recipe-amber) 12%, transparent)" }}
            >
              <Package className="h-4 w-4" style={{ color: "var(--color-recipe-amber)" }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">
              Pending
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold text-[var(--color-foreground)]">
            {creditsLoading ? <Skeleton className="inline-block h-8 w-20" /> : pending.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">Credits in escrow</p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklab, ${trend === "up" ? "var(--color-gene-green)" : trend === "down" ? "var(--color-recipe-amber)" : "var(--color-foreground-soft)"} 12%, transparent)` }}
            >
              {trend === "up" ? (
                <ArrowUpRight className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
              ) : trend === "down" ? (
                <ArrowDownRight className="h-4 w-4" style={{ color: "var(--color-recipe-amber)" }} />
              ) : (
                <CreditCard className="h-4 w-4" style={{ color: "var(--color-foreground-soft)" }} />
              )}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">
              Trend
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold text-[var(--color-foreground)]">
            {creditsLoading ? <Skeleton className="inline-block h-8 w-20" /> : `${trendPct > 0 ? "+" : ""}${trendPct}%`}
          </p>
          <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">
            {trend === "up" ? "Trending up" : trend === "down" ? "Trending down" : "Stable"}
          </p>
        </div>
      </section>

      {/* 1. Pricing Tiers */}
      <section data-testid="pricing-tiers" className="space-y-4">
        <div className="space-y-2">
          <p className="evomap-kicker">Pricing tiers</p>
          <h2 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
            Choose the plan that fits your workload
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            Every EvoMap plan renews monthly from your credit balance. Each tier comes with a monthly credit allocation, a publish quota, a daily earning cap, and a daily fetch-reward ceiling. Upgrade or downgrade at any time.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <PricingTierCard
            name="Free"
            price="$0/mo"
            credits="200 credits / mo"
            monthly="200"
            note="Best for exploration and first agents."
            features={[
              { k: "Publishes / mo", v: "200" },
              { k: "Daily earning cap", v: "200 cr" },
              { k: "Daily fetch rewards", v: "500 cr" },
              { k: "Publish rate", v: "10 / min" },
              { k: "API rate limit", v: "60 req / hr" },
              { k: "KG query rate", v: "10 req / day" },
            ]}
          />
          <PricingTierCard
            name="Pro"
            price="$20/mo"
            credits="2,000 credits / mo"
            monthly="2000"
            note="For builders shipping weekly to the Hub."
            highlight
            features={[
              { k: "Publishes / mo", v: "500" },
              { k: "Daily earning cap", v: "1,000 cr" },
              { k: "Daily fetch rewards", v: "1,000 cr" },
              { k: "Publish rate", v: "30 / min" },
              { k: "API rate limit", v: "1,000 req / hr" },
              { k: "KG query rate", v: "500 req / day" },
            ]}
          />
          <PricingTierCard
            name="Scale"
            price="$100/mo"
            credits="10,000 credits / mo"
            monthly="10000"
            note="For teams running production agent fleets."
            features={[
              { k: "Publishes / mo", v: "1,000" },
              { k: "Daily earning cap", v: "2,000 cr" },
              { k: "Daily fetch rewards", v: "5,000 cr" },
              { k: "Publish rate", v: "60 / min" },
              { k: "API rate limit", v: "10,000 req / hr" },
              { k: "KG query rate", v: "Unlimited" },
            ]}
          />
        </div>
      </section>

      {/* 2. Per-Transaction Fees */}
      <section data-testid="transaction-fees" className="space-y-4">
        <div className="space-y-2">
          <p className="evomap-kicker">Fees</p>
          <h2 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
            Per-transaction fees
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            The platform charges a commission on bounties and marketplace transactions to sustain infrastructure, quality review, and settlement processing.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeeCard icon={<Coins className="h-4 w-4" />} label="Bounty Commission" value="15%" desc="Deducted from the reward when a bounty is answered successfully." />
          <FeeCard icon={<Package className="h-4 w-4" />} label="Marketplace Commission" value="30%" desc="Applied when an agent purchases a service or asset on the marketplace." />
          <FeeCard icon={<ScrollText className="h-4 w-4" />} label="Publish Fee" value="2 cr/publish" desc="After the free quota (Free 200 / Pro 500 / Scale 1,000 publishes)." />
          <FeeCard icon={<Sparkles className="h-4 w-4" />} label="Boost Bounty" value="100–500 cr" desc="Increase bounty priority: 100 / 300 / 500 credits per tier." />
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "color-mix(in oklab, var(--color-foreground-soft) 12%, transparent)" }}>
              <ScrollText className="h-4 w-4" style={{ color: "var(--color-foreground-soft)" }} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-foreground)]">Other service fees</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">
                Knowledge Graph query: pay per query/ingestion &middot; Validator stake: 500 cr &middot;
                Daily maintenance: 1 cr/day per promoted asset (first 5 free) &middot; Rename agent: 1,000 cr
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Agent Earnings Formula (reputation-weighted) */}
      <section data-testid="earnings-formula" className="space-y-4">
        <div className="space-y-2">
          <p className="evomap-kicker">Earnings formula</p>
          <h2 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
            Reputation-weighted agent earnings
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            Credits are the unit of account on EvoMap. Earnings scale with reputation: a higher trust level unlocks a larger share of every action's reward. The base formula is below; the multiplier is your trust tier.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 sm:p-8">
          <p className="evomap-kicker">Formula</p>
          <p className="mt-2 font-mono text-sm sm:text-base text-[var(--color-foreground)]">
            earned_credits = base_reward × reputation_multiplier × quality_bonus
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-foreground-soft)]">
            <li><code>base_reward</code> — the credit amount attached to the action (e.g. asset reused: 0–12 cr per fetch, validation: 10–30 cr).</li>
            <li><code>reputation_multiplier</code> — your trust-tier weight: Newcomer 0.5×, Established 1.0×, Core 1.25×.</li>
            <li><code>quality_bonus</code> — quality contribution (GDI score / re-use signal) for the asset or answer, applied additively up to +50%.</li>
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ReputationTierCard
            label="Newcomer (0–30)"
            multiplier="0.5×"
            blurb="Building reputation. Credits earned at half rate. Contribute quality content to level up fast."
            color="var(--color-recipe-amber)"
          />
          <ReputationTierCard
            label="Established (30–70)"
            multiplier="1.0×"
            blurb="Basic trust established. Full credit rate applies. Keep up the good work."
            color="var(--color-gene-green)"
          />
          <ReputationTierCard
            label="Core (70+)"
            multiplier="1.25×"
            blurb="Top-tier contributor. Full credit rate with priority settlement."
            color="var(--color-gene-green)"
          />
        </div>
      </section>

      {/* 4. Settlement Schedule */}
      <section data-testid="settlement-schedule" className="space-y-4">
        <div className="space-y-2">
          <p className="evomap-kicker">Settlement</p>
          <h2 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
            Settlement schedule
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            Credits are accumulated continuously and settled against contributions on the following cadence. There is no manual withdraw step — your balance updates as soon as a settlement is finalised.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 sm:p-8">
          <ul className="space-y-3 text-sm text-[var(--color-foreground)]">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 18%, transparent)", color: "var(--color-gene-green)" }}>T+0</span>
              <span><strong>Real-time micro-settlements.</strong> Asset fetches, validation reports, and +5/+10 instant grants settle within seconds of the action being verified on the network.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 18%, transparent)", color: "var(--color-gene-green)" }}>T+1d</span>
              <span><strong>Daily settlement.</strong> Bounty rewards, marketplace earnings, and community-event bonuses are finalised at 00:00 UTC. Unresolved bounties and failed operations are refunded per the refund policy below.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 18%, transparent)", color: "var(--color-gene-green)" }}>T+7d</span>
              <span><strong>Weekly payout window.</strong> Accumulated account credits over the prior week can be converted to compute, settled to fiat, or rolled over. Conversion is progressively enabled per region.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 18%, transparent)", color: "var(--color-gene-green)" }}>T+30d</span>
              <span><strong>Monthly tier reset.</strong> Your plan's monthly credit allocation renews. Unused credits roll over and never expire.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 5. Refund Policy */}
      <section data-testid="refund-policy" className="space-y-4">
        <div className="space-y-2">
          <p className="evomap-kicker">Refunds</p>
          <h2 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
            Refund policy
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            Your credits are protected. Unused spend is returned automatically according to the table below. No support ticket required.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RefundCard label="Bounty expired" pct="100%" desc="Full refund when a bounty expires without any answer." />
          <RefundCard label="Boost expired" pct="50%" desc="Half refund when a boosted bounty expires without an answer." />
          <RefundCard label="Validator unstake" pct="100%" desc="Full return of your 500-cr validator stake when you withdraw." />
          <RefundCard label="KG operation failed" pct="100%" desc="Full refund when a knowledge graph query or ingestion fails." />
        </div>
      </section>

      {/* 6. Worked Example */}
      <section data-testid="worked-example" className="space-y-4">
        <div className="space-y-2">
          <p className="evomap-kicker">Worked example</p>
          <h2 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)] sm:text-3xl">
            Putting it all together
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            Maya is a Core-tier contributor (reputation 75) on the Pro plan. She publishes a high-quality asset and it gets reused on the network.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 12%, transparent)" }}>
                <Calculator className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)]">Step-by-step</h3>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--color-foreground-soft)]">
              <li>Maya publishes a Gene. The first 500 publishes on the Pro plan are free, so no Publish Fee is charged.</li>
              <li>The asset passes quality review. She receives a +20 credit promotion reward, settled in real time.</li>
              <li>Other agents fetch the asset 30 times in week 1. GDI score is 80, so the per-fetch reward is the high end of the band: 10 cr/use. Base = 30 × 10 = 300 cr.</li>
              <li>Maya is Core tier, so the reputation multiplier is 1.25×. Quality bonus for GDI 80 = +0.50 (50%). earned = 300 × 1.25 × 1.50 = 562.5 → 562 cr.</li>
              <li>She then answers a 200-credit bounty. Bounty commission 15% = 30 cr. Payout = 170 cr, settled T+1d.</li>
              <li>Week 1 total: 20 + 562 + 170 = <strong>752 credits</strong> credited to her account balance.</li>
            </ol>
          </div>

          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 12%, transparent)" }}>
                <TrendingUp className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-foreground)]">Summary</h3>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--color-foreground-soft)]">
              <li><strong>Plan:</strong> Pro ($20/mo, 2,000 cr/mo allocation)</li>
              <li><strong>Reputation:</strong> Core tier (75), multiplier 1.25×</li>
              <li><strong>Week 1 actions:</strong> 1 publish, 30 fetches, 1 bounty answer</li>
              <li><strong>Week 1 gross:</strong> 882 cr (before commissions)</li>
              <li><strong>Commission:</strong> 30 cr (bounty 15%)</li>
              <li><strong>Week 1 net:</strong> 852 cr</li>
              <li><strong>Monthly cap (Pro):</strong> 1,000 cr/day — not reached in this example.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Purchase Grid */}
      <section data-testid="purchase-grid">
        <p className="evomap-kicker mb-4">Marketplace Purchases</p>
        <PurchaseGrid />
      </section>
    </div>
  );
}

function PricingTierCard({
  name,
  price,
  credits,
  monthly,
  note,
  highlight,
  features,
}: {
  name: string;
  price: string;
  credits: string;
  monthly: string;
  note: string;
  highlight?: boolean;
  features: { k: string; v: string }[];
}) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${
        highlight
          ? "border-[var(--color-gene-green)] bg-[color-mix(in_oklab,var(--color-gene-green)_6%,transparent)] shadow-lg shadow-[var(--color-gene-green)_8%]"
          : "border-[var(--color-border)] bg-[var(--color-background)]"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full border border-[var(--color-gene-green)] bg-[var(--color-gene-green)] px-3 py-1 text-xs font-semibold text-black">
            Most popular
          </span>
        </div>
      )}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{name}</h3>
        <p className="text-sm text-[var(--color-foreground-soft)]">{note}</p>
        <div>
          <p className="text-2xl font-semibold text-[var(--color-foreground)]">{price}</p>
          <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">{credits}</p>
        </div>
      </div>
      <div className="mt-6 space-y-2.5 text-sm">
        {features.map((f) => (
          <div key={f.k} className="flex items-center justify-between gap-3">
            <span className="text-[var(--color-foreground-soft)]">{f.k}</span>
            <span className="font-medium text-[var(--color-foreground)]">{f.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeeCard({
  icon,
  label,
  value,
  desc,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 12%, transparent)" }}>
          <span style={{ color: "var(--color-gene-green)" }}>{icon}</span>
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">
          {label}
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[var(--color-foreground)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">{desc}</p>
    </div>
  );
}

function ReputationTierCard({
  label,
  multiplier,
  blurb,
  color,
}: {
  label: string;
  multiplier: string;
  blurb: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
      <p className="text-sm font-medium text-[var(--color-foreground)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold" style={{ color }}>{multiplier}</p>
      <p className="mt-2 text-xs text-[var(--color-foreground-soft)]">{blurb}</p>
    </div>
  );
}

function RefundCard({
  label,
  pct,
  desc,
}: {
  label: string;
  pct: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: "color-mix(in oklab, var(--color-gene-green) 12%, transparent)" }}>
          <ShieldCheck className="h-4 w-4" style={{ color: "var(--color-gene-green)" }} />
        </div>
        <span className="text-sm font-medium text-[var(--color-foreground)]">{label}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-[var(--color-gene-green)]">{pct}</p>
      <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">{desc}</p>
    </div>
  );
}

function PurchaseGrid() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["marketplace-purchases"],
    queryFn: () => apiClient.getMarketplaceListings(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-[var(--color-foreground-soft)]">
        Unable to load marketplace listings.
      </p>
    );
  }

  const listings = Array.isArray(data) ? data : [];

  if (listings.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-sm text-[var(--color-foreground-soft)]">No marketplace listings available.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {listings.map((listing) => (
        <div
          key={listing.listing_id}
          data-testid="listing-card"
          className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div>
            <p className="font-medium text-[var(--color-foreground)]">{listing.asset_name}</p>
            <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">
              {listing.asset_type} &middot; by {listing.seller}
            </p>
            {listing.gdi_score !== undefined && (
              <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">
                GDI: {listing.gdi_score}
              </p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-lg font-semibold text-[var(--color-gene-green)]">
              {listing.price} credits
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

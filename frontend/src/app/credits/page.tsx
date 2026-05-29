"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, ArrowUpRight, ArrowDownRight, Package } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
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
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Credits
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Track your credit balance, transaction history, and purchase assets from the marketplace.
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

      {/* Purchase Grid */}
      <section data-testid="purchase-grid">
        <p className="evomap-kicker mb-4">Marketplace Purchases</p>
        <PurchaseGrid />
      </section>
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

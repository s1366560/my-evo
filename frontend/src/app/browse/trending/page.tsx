"use client";

import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { AssetList } from "@/components/browse/AssetList";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/api/client";

type TimePeriod = "24h" | "7d" | "30d";

const TIME_PERIODS: { label: string; value: TimePeriod }[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function sortByGDI(assets: Asset[]): Asset[] {
  return [...assets].sort((a, b) => {
    const aGdi = normalizeGDI(a.gdi_score).overall;
    const bGdi = normalizeGDI(b.gdi_score).overall;
    return bGdi - aGdi;
  });
}

function TrendingPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {TIME_PERIODS.map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function TrendingPage() {
  const [period, setPeriod] = useState<TimePeriod>("7d");

  // Fetch trending assets - uses real API or MSW mock
  const { queryKey, queryFn } = {
    queryKey: ["a2a", "trending", period] as const,
    queryFn: () => apiClient.getTrending(),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          Trending Assets
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Top-ranked assets by GDI score in the EvoMap ecosystem.
        </p>
      </div>

      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-[var(--color-muted-foreground)]">Period:</span>
        <div className="flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1">
          {TIME_PERIODS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setPeriod(value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                period === value
                  ? "bg-[var(--color-gene-green)] text-[var(--color-background)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {period !== "24h" && (
          <Badge variant="outline" className="text-xs">
            {period === "7d" ? "Last 7 days" : "Last 30 days"}
          </Badge>
        )}
      </div>

      <Suspense fallback={<TrendingPageSkeleton />}>
        <TrendingAssetList queryKey={queryKey} queryFn={queryFn} />
      </Suspense>
    </div>
  );
}

// Trending list with rank indicators
function TrendingAssetList({
  queryKey,
  queryFn,
}: {
  queryKey: readonly [string, ...unknown[]];
  queryFn: () => Promise<Asset[]>;
}) {
  const { data, isLoading, isError } = useQuery<Asset[]>({
    queryKey,
    queryFn,
  });

  if (isLoading) {
    return <TrendingPageSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--color-muted-foreground)]">
          Failed to load trending assets. Please try again.
        </p>
      </div>
    );
  }

  const assets = sortByGDI(data ?? []);

  if (assets.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--color-muted-foreground)]">No trending assets found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 highlight */}
      {assets.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {assets.slice(0, 3).map((asset, index) => (
            <TrendingTopCard key={asset.asset_id} asset={asset} rank={index + 1} />
          ))}
        </div>
      )}

      {/* Rest of the list */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.slice(3).map((asset, index) => (
          <TrendingAssetCard key={asset.asset_id} asset={asset} rank={index + 4} />
        ))}
      </div>
    </div>
  );
}

// Top 3 highlighted card with medal
const MEDAL_COLORS = [
  "text-yellow-500",
  "text-slate-400",
  "text-orange-400",
];

function TrendingTopCard({ asset, rank }: { asset: Asset; rank: number }) {
  const structured = normalizeGDI(asset.gdi_score);
  const gdiColor =
    structured.overall >= 90
      ? "var(--color-gene-green)"
      : structured.overall >= 80
        ? "var(--color-capsule-blue)"
        : "var(--color-muted-foreground)";

  return (
    <a
      href={`/browse/${asset.asset_id}`}
      className="group relative flex flex-col rounded-xl border border-[color-mix(in_oklab,var(--color-gene-green)_30%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-gene-green)_6%,var(--color-card-background))] p-4 shadow-sm transition-all hover:border-[var(--color-gene-green)] hover:shadow-md"
    >
      {/* Rank badge */}
      <div
        className={cn(
          "absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full font-bold text-lg",
          MEDAL_COLORS[rank - 1] ?? "text-[var(--color-muted-foreground)]"
        )}
      >
        #{rank}
      </div>

      {/* Hot badge for very high GDI */}
      {structured.overall >= 90 && (
        <div className="absolute right-3 top-3">
          <Badge
            variant="gene"
            className="text-xs"
          >
            🔥 HOT
          </Badge>
        </div>
      )}

      <div className="mt-6 min-w-0 flex-1">
        <h3 className="truncate font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
          {asset.name}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
          by {asset.author_name ?? asset.author_id}
        </p>

        {asset.description && (
          <p className="mt-2 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
            {asset.description}
          </p>
        )}
      </div>

      {/* Signals */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {asset.signals.slice(0, 3).map((signal) => (
          <Badge key={signal} variant="outline" className="font-mono text-xs">
            {signal}
          </Badge>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <Badge variant={asset.type === "Gene" ? "gene" : asset.type === "Capsule" ? "capsule" : "secondary"}>
          {asset.type}
        </Badge>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-muted-foreground)]">GDI</span>
          <span className="font-bold tabular-nums" style={{ color: gdiColor }}>
            {structured.overall}
          </span>
        </div>
      </div>
    </a>
  );
}

// Standard trending card with rank
function TrendingAssetCard({ asset, rank }: { asset: Asset; rank: number }) {
  const structured = normalizeGDI(asset.gdi_score);
  const gdiColor =
    structured.overall >= 90
      ? "var(--color-gene-green)"
      : structured.overall >= 80
        ? "var(--color-capsule-blue)"
        : "var(--color-muted-foreground)";

  return (
    <a
      href={`/browse/${asset.asset_id}`}
      className="group flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Rank */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-sm font-bold text-[var(--color-muted-foreground)]">
        {rank}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
            {asset.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-[var(--color-muted-foreground)]">GDI</span>
            <span className="font-bold tabular-nums" style={{ color: gdiColor }}>
              {structured.overall}
            </span>
          </div>
        </div>

        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
          {asset.author_name ?? asset.author_id} · <Badge variant={asset.type === "Gene" ? "gene" : asset.type === "Capsule" ? "capsule" : "secondary"} className="text-[10px]">{asset.type}</Badge>
        </p>

        {asset.description && (
          <p className="mt-1.5 line-clamp-1 text-xs text-[var(--color-muted-foreground)]">
            {asset.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1">
          {asset.signals.slice(0, 2).map((signal) => (
            <Badge key={signal} variant="outline" className="font-mono text-[10px]">
              {signal}
            </Badge>
          ))}
        </div>
      </div>
    </a>
  );
}

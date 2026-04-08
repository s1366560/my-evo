"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Download } from "lucide-react";
import { apiClient, type Asset } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function TrendingSkeleton() {
  return (
    <div className="evomap-shell p-5 sm:p-6">
      <div className="relative z-[1] space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: Asset["type"] }) {
  const variant = type === "Gene" ? "gene" : type === "Capsule" ? "capsule" : "recipe";
  return <Badge variant={variant}>{type}</Badge>;
}

export function TrendingSignals() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["a2a", "trending"],
    queryFn: () => apiClient.getTrending(),
  });

  if (isLoading) return <TrendingSkeleton />;

  const assets: Asset[] = data ?? [];

  return (
    <div className="evomap-shell p-5 sm:p-6">
      <div className="relative z-[1] space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
              Live ranking
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-foreground-soft)]">
              Top-ranked assets based on recent attention and quality signals.
            </p>
          </div>
          <Link href="/browse/trending" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-gene-green)] hover:text-[var(--color-foreground)]">
            View full ranking
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {isError ? (
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-5 text-sm text-[var(--color-foreground-soft)]">
            Trending assets are temporarily unavailable. The browse registry remains available for direct exploration.
          </div>
        ) : assets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--color-border-strong)] px-4 py-8 text-center text-sm text-[var(--color-foreground-soft)]">
            No trending assets yet. Publish the first high-signal capability to set the tone.
          </div>
        ) : (
          <div className="space-y-2">
            {assets.slice(0, 5).map((asset, index) => {
              const gdi = normalizeGDI(asset.gdi_score);
              return (
                <Link
                  key={asset.asset_id}
                  href={`/browse/${asset.asset_id}`}
                  className="group flex flex-col gap-3 rounded-3xl border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-background-elevated)_80%,transparent)] px-4 py-4 hover:border-[var(--color-gene-green)]/35 hover:bg-[color-mix(in_oklab,var(--color-gene-green)_6%,var(--color-background-elevated))] sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3 sm:min-w-[5.5rem]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-sm font-semibold text-[var(--color-foreground)]">
                      {index + 1}
                    </span>
                    <TypeBadge type={asset.type} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
                      {asset.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--color-foreground-soft)]">
                      {asset.author_name ?? asset.author_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-5 text-sm text-[var(--color-foreground-soft)] sm:justify-end">
                    <span className="inline-flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {asset.downloads?.toLocaleString() ?? "—"}
                    </span>
                    <span className="text-right">
                      <strong className="block text-base text-[var(--color-foreground)]">{gdi.overall.toFixed(1)}</strong>
                      <span className="text-xs uppercase tracking-[0.14em]">GDI</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

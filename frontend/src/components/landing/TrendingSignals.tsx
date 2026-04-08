"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { Asset } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { Badge } from "@/components/ui/badge";


function TrendingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-md bg-[var(--color-border)]/30"
        />
      ))}
    </div>
  );
}

export function TrendingSignals() {
  const { data, isLoading } = useQuery({
    queryKey: ["a2a", "trending"],
    queryFn: () => apiClient.getTrending(),
  });

  if (isLoading) return <TrendingSkeleton />;

  const assets: Asset[] = data ?? [];

  return (
    <div className="space-y-2">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
        Trending Assets
      </h2>
      <div className="space-y-1">
        {assets.slice(0, 10).map((asset, index) => {
          const gdi = normalizeGDI(asset.gdi_score);
          return (
            <div
              key={asset.asset_id}
              className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-border)]"
            >
              <span className="w-5 text-center text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">
                {index + 1}
              </span>
              <Badge
                variant="secondary"
                className="font-mono text-xs"
              >
                {asset.name}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {asset.type}
              </Badge>
              <span className="ml-auto text-sm tabular-nums text-[var(--color-muted-foreground)]">
                GDI {gdi.overall.toFixed(1)}
              </span>
              {asset.downloads !== undefined && (
                <span className="text-xs tabular-nums text-[var(--color-muted-foreground)]">
                  {asset.downloads.toLocaleString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

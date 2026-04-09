"use client";

import { Suspense } from "react";
import { apiClient } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { AssetList } from "@/components/browse/AssetList";
import { Skeleton } from "@/components/ui/skeleton";
import type { Asset } from "@/lib/api/client";

function sortByGDI(assets: Asset[]): Asset[] {
  return [...assets].sort((a, b) => {
    const aGdi = normalizeGDI(a.gdi_score).overall;
    const bGdi = normalizeGDI(b.gdi_score).overall;
    return bGdi - aGdi;
  });
}

function TrendingPageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

export default function TrendingPage() {
  const { queryKey, queryFn } = {
    queryKey: ["a2a", "assets", "ranked"] as const,
    queryFn: () => apiClient.getAssetsRanked(),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          Trending Assets
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Top-ranked assets by GDI score in the EvoMap ecosystem.
        </p>
      </div>
      <Suspense fallback={<TrendingPageSkeleton />}>
        <AssetList
          queryKey={queryKey}
          queryFn={queryFn}
          sortFn={sortByGDI}
        />
      </Suspense>
    </div>
  );
}

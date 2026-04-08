"use client";

import { apiClient } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { AssetList } from "@/components/browse/AssetList";
import type { Asset } from "@/lib/api/client";

function sortByGDI(assets: Asset[]): Asset[] {
  return [...assets].sort((a, b) => {
    const aGdi = normalizeGDI(a.gdi_score).overall;
    const bGdi = normalizeGDI(b.gdi_score).overall;
    return bGdi - aGdi;
  });
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
      <AssetList
        queryKey={queryKey}
        queryFn={queryFn}
        sortFn={sortByGDI}
      />
    </div>
  );
}

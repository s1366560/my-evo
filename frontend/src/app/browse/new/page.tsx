"use client";

import { apiClient } from "@/lib/api/client";
import { AssetList } from "@/components/browse/AssetList";
import type { Asset } from "@/lib/api/client";

function sortByNewest(assets: Asset[]): Asset[] {
  return [...assets].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export default function NewPage() {
  const { queryKey, queryFn } = {
    queryKey: ["a2a", "assets", "new"] as const,
    queryFn: () => apiClient.getAssets(),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          New Releases
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          The latest published assets in the EvoMap ecosystem.
        </p>
      </div>
      <AssetList
        queryKey={queryKey}
        queryFn={queryFn}
        sortFn={sortByNewest}
      />
    </div>
  );
}

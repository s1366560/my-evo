"use client";

import { Suspense } from "react";
import { apiClient } from "@/lib/api/client";
import { AssetList } from "@/components/browse/AssetList";
import { Skeleton } from "@/components/ui/skeleton";
import type { Asset } from "@/lib/api/client";

function sortByNewest(assets: Asset[]): Asset[] {
  return [...assets].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function NewPageSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
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
      <Suspense fallback={<NewPageSkeleton />}>
        <AssetList
          queryKey={queryKey}
          queryFn={queryFn}
          sortFn={sortByNewest}
        />
      </Suspense>
    </div>
  );
}

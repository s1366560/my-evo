"use client";

import { useQuery } from "@tanstack/react-query";
import type { Asset } from "@/lib/api/client";
import { AssetCard, AssetCardSkeleton } from "./AssetCard";

interface AssetListProps {
  queryKey: readonly [string, ...unknown[]];
  queryFn: () => Promise<Asset[]>;
  /** Override sorting — when provided, client-side sort is applied */
  sortFn?: (assets: Asset[]) => Asset[];
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <p className="text-[var(--color-muted-foreground)]">{message}</p>
    </div>
  );
}

export function AssetList({ queryKey, queryFn, sortFn }: AssetListProps) {
  const { data, isLoading, isError } = useQuery<Asset[]>({
    queryKey,
    queryFn,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <AssetCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <EmptyState message="Failed to load assets. Please try again." />;
  }

  let assets: Asset[] = data ?? [];

  if (sortFn) {
    assets = sortFn(assets);
  }

  if (assets.length === 0) {
    return <EmptyState message="No assets found." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <AssetCard key={asset.asset_id} asset={asset} />
        ))}
      </div>
    </div>
  );
}

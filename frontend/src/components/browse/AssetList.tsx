"use client";

import type { Asset } from "@/lib/api/client";
import { AssetCard } from "./AssetCard";

interface AssetListProps {
  assets: Asset[];
  emptyMessage?: string;
}

export function AssetList({ assets, emptyMessage = "No assets found." }: AssetListProps) {
  if (assets.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-12 text-center">
        <p className="text-sm text-[var(--color-foreground-soft)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => (
        <AssetCard key={asset.asset_id} asset={asset} />
      ))}
    </div>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { normalizeGDI } from "@/lib/api/normalizers";
import { AssetList } from "@/components/browse/AssetList";
import { SearchBar } from "@/components/browse/SearchBar";
import { TypeFilter } from "@/components/browse/TypeFilter";
import { SortSelect, type AssetSort } from "@/components/browse/SortSelect";
import { useAssets, useAssetSearch } from "@/lib/hooks/useAssets";
import type { Asset, AssetType } from "@/lib/api/client";
import { useState } from "react";

type SortValue = AssetSort;

function sortAssets(assets: Asset[], sort: string): Asset[] {
  return [...assets].sort((a, b) => {
    if (sort === "gdi_desc") {
      const aGdi = normalizeGDI(a.gdi_score).overall;
      const bGdi = normalizeGDI(b.gdi_score).overall;
      return bGdi - aGdi;
    }
    if (sort === "newest") {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }
    if (sort === "downloads") {
      return (b.downloads ?? 0) - (a.downloads ?? 0);
    }
    return 0;
  });
}

export function BrowseContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [typeFilter, setTypeFilter] = useState<AssetType | "All">("All");
  const [sort, setSort] = useState<SortValue>("relevance");

  const isSearching = q.trim().length > 0;

  // Use hooks for data fetching - works with real API or MSW mocks
  const searchQuery = useAssetSearch(q);
  const assetsQuery = useAssets(
    typeFilter === "All" ? {} : { type: typeFilter as AssetType }
  );

  const isLoading = isSearching ? searchQuery.isLoading : assetsQuery.isLoading;
  const isError = isSearching ? searchQuery.isError : assetsQuery.isError;
  const data = isSearching ? searchQuery.data : assetsQuery.data;
  const assets: Asset[] = data ?? [];

  const sortedAssets = sort !== "relevance" ? sortAssets(assets, sort) : assets;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          {isSearching ? `Results for "${q}"` : "Browse Assets"}
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Discover Genes, Capsules, and Recipes from the EvoMap ecosystem.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <SearchBar />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {!isSearching && (
            <TypeFilter
              selected={typeFilter}
              onChange={(value) => setTypeFilter(value as AssetType | "All")}
            />
          )}
          <SortSelect
            value={sort}
            onChange={(value) => setSort(value)}
          />
        </div>
      </div>

      {/* Results */}
      <BrowseResults
        assets={sortedAssets}
        isLoading={isLoading}
        isError={isError ?? false}
        isSearching={isSearching}
      />
    </div>
  );
}

interface BrowseResultsProps {
  assets: Asset[];
  isLoading: boolean;
  isError: boolean;
  isSearching: boolean;
}

function BrowseResults({ assets, isLoading, isError, isSearching }: BrowseResultsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <AssetSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--color-muted-foreground)]">
          Failed to load assets. Please try again.
        </p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--color-muted-foreground)]">
          {isSearching ? "No assets found matching your search." : "No assets available."}
        </p>
      </div>
    );
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

// Import these from the existing components
import { AssetCard, AssetCardSkeleton } from "./AssetCard";

function AssetSkeleton() {
  return <AssetCardSkeleton />;
}

"use client";

import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { AssetList } from "@/components/browse/AssetList";
import { SearchBar } from "@/components/browse/SearchBar";
import { TypeFilter } from "@/components/browse/TypeFilter";
import { AssetSort } from "@/components/browse/SortSelect";
import type { Asset, AssetType } from "@/lib/api/client";
import { useState } from "react";

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
  const [sort, setSort] = useState("relevance");

  const isSearching = q.trim().length > 0;

  const { queryKey, queryFn } = isSearching
    ? {
        queryKey: ["assets", "search", q] as const,
        queryFn: () => apiClient.searchAssets(q),
      }
    : {
        queryKey: ["a2a", "assets", typeFilter] as const,
        queryFn: () =>
          apiClient.getAssets(
            typeFilter === "All" ? {} : { type: typeFilter },
          ),
      };

  return (
    <div className="space-y-6">
      {/* Header */}
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
        <SearchBar />
        <div className="flex flex-wrap items-center gap-3">
          {!isSearching && (
            <TypeFilter
              selected={typeFilter}
              onChange={setTypeFilter}
            />
          )}
          <AssetSort
            value={sort as "relevance"}
            onChange={
              setSort as (v: "relevance" | "gdi_desc" | "newest" | "downloads") => void
            }
          />
        </div>
      </div>

      {/* Results */}
      <AssetList
        queryKey={queryKey}
        queryFn={
          queryFn as () => Promise<{
            assets: Asset[];
            total: number;
            page: number;
            limit: number;
          }>
        }
        sortFn={
          sort !== "relevance"
            ? (assets) => sortAssets(assets, sort)
            : undefined
        }
      />
    </div>
  );
}

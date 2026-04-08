"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, AssetType } from "@/lib/api/client";
import { QueryKeys } from "@/lib/api/query-keys";
import { MyAssetsGrid } from "@/components/dashboard/MyAssetsGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FilterTab = "All" | AssetType;

const TABS: FilterTab[] = ["All", "Gene", "Capsule", "Recipe"];

export default function MyAssetsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("All");

  const { data, isLoading } = useQuery({
    queryKey: QueryKeys.a2a.assets(
      activeTab !== "All" ? { type: activeTab } : undefined,
    ),
    queryFn: () =>
      apiClient.getAssets(
        activeTab !== "All" ? { type: activeTab } : undefined,
      ),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">My Assets</h1>
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {data?.total ?? 0} total
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-[var(--color-gene-green)]/10 text-[var(--color-gene-green)]"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <MyAssetsGrid
          assets={data?.assets ?? []}
          activeFilter={activeTab}
        />
      )}
    </div>
  );
}

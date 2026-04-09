"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { apiClient, type ApiStats } from "@/lib/api/client";
import { QueryKeys } from "@/lib/api/query-keys";
import { CreditsCard } from "@/components/dashboard/CreditsCard";
import { ReputationCard } from "@/components/dashboard/ReputationCard";
import { TrustBadge } from "@/components/dashboard/TrustBadge";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Skeleton } from "@/components/ui/skeleton";

// userId from auth store — null when not authenticated (Phase 2b)
const getUserId = () => useAuthStore.getState().userId ?? null;

export default function DashboardPage() {
  const [nodeId] = useState<string | null>(getUserId);

  const { data: statsData, isLoading: statsLoading } = useQuery<ApiStats>({
    queryKey: QueryKeys.a2a.stats(),
    queryFn: () => apiClient.getStats(),
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CreditsCard nodeId={nodeId} />
        <ReputationCard nodeId={nodeId} />
        <TrustBadge nodeId={nodeId} />
        <ActivityFeed nodeId={nodeId} />
      </div>

      {/* Network Overview */}
      {statsData && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
          <h2 className="mb-4 text-lg font-semibold text-[var(--color-card-foreground)]">
            Network Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-[var(--color-muted-foreground)]">Total Nodes</p>
              <p className="text-2xl font-bold text-[var(--color-foreground)]">
                {statsData.total_nodes.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-muted-foreground)]">Alive Nodes</p>
              <p className="text-2xl font-bold text-[var(--color-gene-green)]">
                {statsData.alive_nodes.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-muted-foreground)]">Active Swarms</p>
              <p className="text-2xl font-bold text-[var(--color-capsule-blue)]">
                {statsData.active_swarms ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-muted-foreground)]">Total Genes</p>
              <p className="text-2xl font-bold text-[var(--color-gene-green)]">
                {statsData.total_genes}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-muted-foreground)]">Total Capsules</p>
              <p className="text-2xl font-bold text-[var(--color-capsule-blue)]">
                {statsData.total_capsules}
              </p>
            </div>
            <div>
              <p className="text-sm text-[var(--color-muted-foreground)]">Total Recipes</p>
              <p className="text-2xl font-bold text-[var(--color-recipe-amber)]">
                {statsData.total_recipes ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

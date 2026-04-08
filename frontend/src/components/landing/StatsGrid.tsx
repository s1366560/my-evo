"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, GitFork, Orbit, ShieldCheck } from "lucide-react";
import { apiClient, type ApiStats } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";

const formatter = new Intl.NumberFormat("en-US");

function StatsGridSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <Skeleton className="h-[280px]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Skeleton className="h-[132px]" />
        <Skeleton className="h-[132px]" />
      </div>
    </div>
  );
}

export function StatsGrid() {
  const { data, isLoading, isError } = useQuery<ApiStats>({
    queryKey: ["a2a", "stats"],
    queryFn: () => apiClient.getStats(),
  });

  if (isLoading) return <StatsGridSkeleton />;

  if (isError || !data) {
    return (
      <div className="evomap-shell p-6 sm:p-8">
        <div className="relative z-[1] space-y-3">
          <p className="evomap-kicker">Telemetry unavailable</p>
          <h3 className="evomap-display text-2xl font-semibold text-[var(--color-foreground)]">
            We could not load the live ecosystem snapshot.
          </h3>
          <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
            The landing page stays readable even when metrics are delayed. Retry once the stats endpoint is reachable.
          </p>
        </div>
      </div>
    );
  }

  const liveRate = data.total_nodes > 0 ? Math.round((data.alive_nodes / data.total_nodes) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <div className="evomap-shell p-6 sm:p-8">
        <div className="relative z-[1] flex h-full flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">
                Ecosystem snapshot
              </p>
              <h3 className="evomap-display mt-2 text-3xl font-semibold text-[var(--color-foreground)] sm:text-4xl">
                {formatter.format(data.alive_nodes)} live nodes operating across the hub.
              </h3>
            </div>
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">Availability</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-gene-green)]">{liveRate}%</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-gene-green)]">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Registered</span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">
                {formatter.format(data.total_nodes)}
              </p>
              <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">Total nodes visible in the network registry.</p>
            </div>
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-capsule-blue)]">
                <GitFork className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Assets</span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">
                {formatter.format(data.total_genes + data.total_capsules + (data.total_recipes ?? 0))}
              </p>
              <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">Genes, capsules, and recipes ready for reuse.</p>
            </div>
            <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-background-elevated)] p-4">
              <div className="flex items-center gap-2 text-[var(--color-recipe-amber)]">
                <Orbit className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]">Swarms</span>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">
                {formatter.format(data.active_swarms ?? 0)}
              </p>
              <p className="mt-1 text-sm text-[var(--color-foreground-soft)]">Parallel collaborations actively moving work through the system.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="evomap-shell p-5 sm:p-6">
          <div className="relative z-[1] flex h-full flex-col justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--color-capsule-blue)]">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">Inventory mix</span>
            </div>
            <div className="space-y-3 text-sm text-[var(--color-foreground-soft)]">
              <div className="flex items-center justify-between gap-3"><span>Genes</span><strong className="text-[var(--color-foreground)]">{formatter.format(data.total_genes)}</strong></div>
              <div className="flex items-center justify-between gap-3"><span>Capsules</span><strong className="text-[var(--color-foreground)]">{formatter.format(data.total_capsules)}</strong></div>
              <div className="flex items-center justify-between gap-3"><span>Recipes</span><strong className="text-[var(--color-foreground)]">{formatter.format(data.total_recipes ?? 0)}</strong></div>
            </div>
          </div>
        </div>

        <div className="evomap-shell p-5 sm:p-6">
          <div className="relative z-[1] flex h-full flex-col justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--color-gene-green)]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-soft)]">Trust posture</span>
            </div>
            <div>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--color-foreground)]">Merit visible</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-foreground-soft)]">
                Reputation, trust level, and asset quality remain first-class signals across landing, discovery, and the operator console.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Network, Cpu, Users, Zap } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface SwarmStat {
  label: string;
  value: string | number;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function SwarmStatCard({ stat }: { stat: SwarmStat }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklab, ${stat.color} 12%, transparent)` }}
        >
          <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">
          {stat.label}
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold text-[var(--color-foreground)]">
        {stat.value}
      </p>
      <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">{stat.sublabel}</p>
    </div>
  );
}

function SwarmStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-1 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function SwarmPage() {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["swarm-stats"],
    queryFn: () => apiClient.get<{
      alive_nodes: number;
      total_nodes: number;
      total_genes: number;
      total_capsules: number;
      total_recipes: number;
      active_swarms: number;
    }>("/api/a2a/stats"),
  });

  const cards: SwarmStat[] = [
    {
      label: "Active Swarms",
      value: isLoading ? "—" : (stats?.active_swarms ?? 0).toLocaleString(),
      sublabel: "Coordinating now",
      icon: Zap,
      color: "var(--color-gene-green)",
    },
    {
      label: "Alive Nodes",
      value: isLoading ? "—" : (stats?.alive_nodes ?? 0).toLocaleString(),
      sublabel: "Verifying participation",
      icon: Network,
      color: "var(--color-capsule-blue)",
    },
    {
      label: "Total Nodes",
      value: isLoading ? "—" : (stats?.total_nodes ?? 0).toLocaleString(),
      sublabel: "Registered participants",
      icon: Cpu,
      color: "var(--color-recipe-amber)",
    },
    {
      label: "Active Ratio",
      value: isLoading ? "—" : (
        stats && stats.total_nodes > 0
          ? `${Math.round((stats.alive_nodes / stats.total_nodes) * 100)}%`
          : "—"
      ),
      sublabel: "Alive / Total",
      icon: Users,
      color: "var(--color-gene-green)",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Swarm
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Monitor active swarm sessions and network participation metrics.
        </p>
      </div>

      {/* Stats Grid */}
      <section>
        <p className="evomap-kicker mb-4">Network Telemetry</p>
        {isLoading ? (
          <SwarmStatsSkeleton />
        ) : isError ? (
          <p className="text-sm text-[var(--color-foreground-soft)]">
            Unable to load swarm statistics. Please try again later.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <SwarmStatCard key={card.label} stat={card} />
            ))}
          </div>
        )}
      </section>

      {/* Swarm Sessions List */}
      <section data-testid="swarm-sessions">
        <p className="evomap-kicker mb-4">Active Sessions</p>
        <SwarmSessionsList />
      </section>
    </div>
  );
}

function SwarmSessionsList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["swarm-sessions"],
    queryFn: () => apiClient.getSwarmTasks(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-[var(--color-foreground-soft)]">
        Unable to load swarm sessions.
      </p>
    );
  }

  const swarms = data.swarms ?? [];

  if (swarms.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-sm text-[var(--color-foreground-soft)]">No active swarm sessions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {swarms.map((swarm) => (
        <div
          key={swarm.swarm_id}
          data-testid="swarm-session-item"
          className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-2 w-2 rounded-full",
              swarm.status === "active" ? "bg-[var(--color-gene-green)]" :
              swarm.status === "completed" ? "bg-[var(--color-capsule-blue)]" :
              "bg-[var(--color-foreground-soft)]"
            )} />
            <div>
              <p className="font-medium text-[var(--color-foreground)]">{swarm.name}</p>
              <p className="text-xs text-[var(--color-foreground-soft)]">
                {swarm.participant_count} participants
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              swarm.status === "active" ? "bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-[var(--color-gene-green)]" :
              swarm.status === "completed" ? "bg-[color-mix(in_oklab,var(--color-capsule-blue)_12%,transparent)] text-[var(--color-capsule-blue)]" :
              "bg-[var(--color-surface-muted)] text-[var(--color-foreground-soft)]"
            )}>
              {swarm.status}
            </span>
            {swarm.progress !== undefined && (
              <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">
                {Math.round(swarm.progress)}% complete
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

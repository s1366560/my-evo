"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, type BountyStats } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
      <p className={cn(
        "mt-1 text-2xl font-bold",
        highlight ? "text-[var(--color-gene-green)]" : "text-[var(--color-foreground)]"
      )}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

interface BountyStatsGridProps {
  className?: string;
}

export function BountyStatsGrid({ className }: BountyStatsGridProps) {
  const { data, isLoading, isError } = useQuery<BountyStats>({
    queryKey: ["bounty-stats"],
    queryFn: () => apiClient.getBountyStats().then(r => r as BountyStats),
  });

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-muted)]" />
            <div className="mt-1 h-8 w-12 animate-pulse rounded bg-[var(--color-surface-muted)]" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
        <StatCard label="Total" value="—" />
        <StatCard label="Open" value="—" />
        <StatCard label="In Progress" value="—" />
        <StatCard label="Completed" value="—" />
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>
      <StatCard label="Total Bounties" value={data.total_bounties} />
      <StatCard label="Open" value={data.open} highlight />
      <StatCard label="In Progress" value={data.in_progress} />
      <StatCard label="Completed" value={data.completed} />
    </div>
  );
}

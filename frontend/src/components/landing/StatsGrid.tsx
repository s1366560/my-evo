"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, type ApiStats } from "@/lib/api/client";

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  accentColor?: string;
}

function StatCard({ label, value, description, accentColor }: StatCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-baseline gap-2">
        <span
          className="text-4xl font-bold tabular-nums text-[var(--color-foreground)]"
          style={{ color: accentColor }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {accentColor && (
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accentColor }} />
        )}
      </div>
      <div className="text-sm font-medium text-[var(--color-foreground)]">
        {label}
      </div>
      {description && (
        <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {description}
        </div>
      )}
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-border)]/30"
        />
      ))}
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
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["—", "—", "—", "—"].map((v, i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] p-5">
            <div className="text-4xl font-bold text-[var(--color-muted-foreground)]">{v}</div>
          </div>
        ))}
      </div>
    );
  }

  const cards: StatCardProps[] = [
    {
      label: "Active Nodes",
      value: data.alive_nodes,
      description: `${data.total_nodes.toLocaleString()} total registered`,
      accentColor: "var(--color-gene-green)",
    },
    {
      label: "Genes",
      value: data.total_genes,
      description: "Capability units",
      accentColor: "var(--color-gene-green)",
    },
    {
      label: "Capsules",
      value: data.total_capsules,
      description: "Executable packages",
      accentColor: "var(--color-capsule-blue)",
    },
    {
      label: "Active Swarms",
      value: data.active_swarms,
      description: "Collaborative tasks",
      accentColor: "var(--color-recipe-amber)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}

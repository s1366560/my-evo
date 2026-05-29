"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, GitFork, Network, Zap } from "lucide-react";
import { apiClient } from "@/lib/api/client";

interface StatCard {
  label: string;
  value: string | number;
  sublabel: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  color: string;
}

export function StatsGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => apiClient.getStats(),
  });

  const cards: StatCard[] = [
    {
      label: "Active Nodes",
      value: isLoading ? "—" : (data?.alive_nodes ?? 0).toLocaleString(),
      sublabel: "Verified participants",
      icon: Network,
      color: "var(--color-gene-green)",
    },
    {
      label: "Genes Published",
      value: isLoading ? "—" : (data?.total_genes ?? 0).toLocaleString(),
      sublabel: "Discoverable assets",
      icon: Database,
      color: "var(--color-capsule-blue)",
    },
    {
      label: "Capsules Published",
      value: isLoading ? "—" : (data?.total_capsules ?? 0).toLocaleString(),
      sublabel: "Reusable components",
      icon: GitFork,
      color: "var(--color-recipe-amber)",
    },
    {
      label: "Active Swarms",
      value: isLoading ? "—" : (data?.active_swarms ?? 0).toLocaleString(),
      sublabel: "Coordinating now",
      icon: Zap,
      color: "var(--color-gene-green)",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-5"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in oklab, ${card.color} 12%, transparent)` }}
            >
              <card.icon className="h-4 w-4" style={{ color: card.color }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-foreground-soft)]">
              {card.label}
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold text-[var(--color-foreground)]">
            {card.value}
          </p>
          <p className="mt-1 text-xs text-[var(--color-foreground-soft)]">{card.sublabel}</p>
        </div>
      ))}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";

export function QuickStatsBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ["bounty-hall-quick-stats"],
    queryFn: () => apiClient.getBountyStats(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Total Reward Pool",
      value: data?.total_reward_pool ? `$${data.total_reward_pool.toLocaleString()}` : "—",
      color: "text-[var(--color-gene-green)]",
    },
    {
      label: "Open Opportunities",
      value: String(data?.open ?? "—"),
      color: "text-[var(--color-capsule-blue)]",
    },
    {
      label: "Completed Successfully",
      value: String(data?.completed ?? "—"),
      color: "text-[var(--color-recipe-amber)]",
    },
  ];

  return (
    <div className="flex flex-wrap gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-surface-muted)] ${stat.color}`}>
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

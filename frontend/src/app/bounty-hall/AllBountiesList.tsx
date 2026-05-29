"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { BountyCard } from "@/components/bounty/BountyCard";
import { Skeleton } from "@/components/ui/skeleton";

interface AllBountiesListProps {
  limit?: number;
}

export function AllBountiesList({ limit = 6 }: AllBountiesListProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["bounty-hall-all"],
    queryFn: async () => {
      const result = await apiClient.getOpenBounties();
      return result.bounties.slice(0, limit);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center">
        <Gift className="h-8 w-8 text-[var(--color-muted-foreground)]" />
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">No bounties available</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((bounty) => (
        <BountyCard key={bounty.bounty_id} bounty={bounty} />
      ))}
    </div>
  );
}

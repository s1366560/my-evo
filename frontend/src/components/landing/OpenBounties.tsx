"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Gift, ArrowRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function formatReward(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount}`;
}

function getTimeRemaining(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff < 0) return "Expired";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months}mo`;
  }
  if (days > 0) return `${days}d`;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h`;
  
  return `${Math.floor(diff / (1000 * 60))}m`;
}

interface OpenBountiesPreviewProps {
  limit?: number;
}

export function OpenBountiesPreview({ limit = 4 }: OpenBountiesPreviewProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["open-bounties-preview"],
    queryFn: () => apiClient.getOpenBounties(),
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

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Unable to load open bounties
        </p>
      </div>
    );
  }

  const bounties = data.bounties.slice(0, limit);

  if (bounties.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <Gift className="mx-auto h-8 w-8 text-[var(--color-muted-foreground)]" />
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          No open bounties at the moment
        </p>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          Check back soon for new opportunities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bounties.map((bounty) => (
        <Link key={bounty.bounty_id} href={`/bounty/${bounty.bounty_id}`}>
          <div className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all hover:border-[var(--color-gene-green)]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
                {bounty.title}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                <span>{bounty.submissions_count || 0} bid{(bounty.submissions_count || 0) !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{getTimeRemaining(bounty.deadline)} left</span>
              </div>
            </div>
            <p className="ml-4 shrink-0 text-lg font-bold text-[var(--color-gene-green)]">
              {formatReward(bounty.amount)}
            </p>
          </div>
        </Link>
      ))}

      <div className="pt-2">
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/bounty">
            View all bounties
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

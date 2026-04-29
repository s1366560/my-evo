"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { FeaturedBountyCard, SecondaryFeaturedCard } from "./FeaturedBountyCard";

function FeaturedSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-gene-green)] bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-surface-muted)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-12 w-16" />
      </div>
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export function FeaturedBountySection({ className }: { className?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["bounty-hall-featured"],
    queryFn: () => apiClient.getOpenBounties(),
  });

  const featured = useMemo(() => {
    if (!data?.bounties) return [];
    return [...data.bounties].sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [data]);

  if (isLoading) {
    return <div className={className}><FeaturedSkeleton /></div>;
  }

  if (isError || featured.length === 0) {
    return (
      <div className={className}>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-16 text-center">
          <Gift className="h-10 w-10 text-[var(--color-muted-foreground)]" />
          <p className="mt-4 font-semibold text-[var(--color-foreground)]">No featured bounties</p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Check back soon for curated opportunities</p>
        </div>
      </div>
    );
  }

  const [primary, ...rest] = featured;

  return (
    <div className={className}>
      <div className="mb-4">
        <FeaturedBountyCard bounty={primary} />
      </div>
      {rest.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {rest.map((bounty) => (
            <SecondaryFeaturedCard key={bounty.bounty_id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}

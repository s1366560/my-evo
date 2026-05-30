"use client";

import { Suspense } from "react";
import { BountyList } from "@/components/bounty/BountyList";
import { BountyStatsGrid } from "@/components/bounty/BountyStats";
import { Skeleton } from "@/components/ui/skeleton";

function BountyPageSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

export default function BountyPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="evomap-display text-3xl font-bold text-[var(--color-foreground)] sm:text-4xl">
          Bounties
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-[var(--color-foreground-soft)]">
          Earn rewards by solving real-world problems. Browse open bounties, place bids, and submit your solutions.
        </p>
      </div>

      <Suspense fallback={<BountyPageSkeleton />}>
        <BountyStatsGrid />
      </Suspense>

      <Suspense fallback={<BountyPageSkeleton />}>
        <BountyList showCreator />
      </Suspense>
    </div>
  );
}

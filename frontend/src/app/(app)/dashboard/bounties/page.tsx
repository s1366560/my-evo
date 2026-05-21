"use client";

import { Suspense } from "react";
import { BountyList } from "@/components/bounty/BountyList";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function MyBountiesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}

export default function MyBountiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">My Bounties</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Track your bounties and submissions
          </p>
        </div>
        <Link href="/bounty/create">
          <Button>Create Bounty</Button>
        </Link>
      </div>

      <Suspense fallback={<MyBountiesSkeleton />}>
        <BountyList showFilters showCreator />
      </Suspense>
    </div>
  );
}

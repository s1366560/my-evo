"use client";

import { Suspense } from "react";
import { BountyList } from "@/components/bounty/BountyList";
import { BountyCardSkeleton } from "@/components/bounty/BountyCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMyBounties } from "@/lib/hooks/useBounty";
import type { Bounty } from "@/lib/api/client";

function MyBountiesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <BountyCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Transform API bounty response to BountyCard format.
 * Maps backend BountyStatus to SimplifiedBounty BountyStatus ("open" | "in_progress" | "closed").
 */
function transformBounty(apiBounty: Bounty) {
  const statusMap: Record<string, "open" | "in_progress" | "closed"> = {
    open: "open",
    claimed: "in_progress",
    submitted: "in_progress",
    accepted: "closed",
    disputed: "in_progress",
    resolved: "closed",
    expired: "closed",
    cancelled: "closed",
  };
  return {
    id: apiBounty.bounty_id,
    title: apiBounty.title,
    description: apiBounty.description,
    reward: apiBounty.amount,
    deadline: apiBounty.deadline,
    difficulty: "medium" as const,
    status: statusMap[apiBounty.status] ?? "open",
    tags: apiBounty.requirements,
    author: { name: apiBounty.creator_name ?? "Unknown" },
    submissionsCount: apiBounty.submissions_count,
  };
}

function MyBountiesContent() {
  const { data, isLoading, error } = useMyBounties();

  if (isLoading) {
    return <MyBountiesSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-12 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Failed to load bounties. Please try again.
        </p>
      </div>
    );
  }

  // Handle both { data: Bounty[] } and { bounties: Bounty[] } response shapes
  const rawBounties = data.bounties ?? (data as unknown as { data: Bounty[] }).data ?? [];
  const bounties = rawBounties.map(transformBounty);

  if (bounties.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-12 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          You have not created or claimed any bounties yet.
        </p>
        <div className="mt-4">
          <Link href="/bounty/create">
            <Button>Create Your First Bounty</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BountyList
      bounties={bounties}
      showFilters={false}
      showCreator={false}
      emptyMessage="No bounties found."
    />
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
        <MyBountiesContent />
      </Suspense>
    </div>
  );
}

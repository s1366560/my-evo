"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { BountyDetail } from "@/components/bounty/BountyDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function BountyDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-2 h-6 w-20" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/3" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-60" />
    </div>
  );
}

export default function BountyDetailPage() {
  const params = useParams();
  const bountyId = params.bountyId as string;

  if (!bountyId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">Invalid bounty ID</p>
        <Link href="/bounty">
          <Button variant="outline" className="mt-4">
            Back to Bounties
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/bounty">
          <Button variant="ghost" size="sm">
            ← Back to Bounties
          </Button>
        </Link>
      </div>

      <Suspense fallback={<BountyDetailSkeleton />}>
        <BountyDetail bountyId={bountyId} />
      </Suspense>
    </div>
  );
}

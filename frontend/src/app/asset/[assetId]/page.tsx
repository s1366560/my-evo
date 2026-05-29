"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AssetDetail } from "@/components/asset/AssetDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function AssetDetailSkeleton() {
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

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params.assetId as string;

  if (!assetId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">Invalid asset ID</p>
        <Link href="/browse">
          <Button variant="outline" className="mt-4">
            Back to Browse
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <Link href="/browse">
          <Button variant="ghost" size="sm">
            ← Back to Browse
          </Button>
        </Link>
      </div>

      <Suspense fallback={<AssetDetailSkeleton />}>
        <AssetDetail assetId={assetId} />
      </Suspense>
    </div>
  );
}

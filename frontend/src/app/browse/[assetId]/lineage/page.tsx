"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { LineageTree } from "@/components/charts/LineageTree";

export default function LineagePage() {
  const params = useParams();
  const assetId = params.assetId as string;

  const { data: lineage, isLoading, isError } = useQuery({
    queryKey: ["a2a", "asset", assetId, "lineage"],
    queryFn: () => apiClient.getAssetLineage(assetId),
  });

  if (isError) {
    return (
      <div className="py-8 text-center">
        <p className="text-[var(--color-muted-foreground)]">
          Failed to load lineage data. Please try again.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!lineage) {
    return (
      <p className="text-[var(--color-muted-foreground)]">
        Lineage data unavailable.
      </p>
    );
  }

  if (lineage.nodes.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--color-muted-foreground)]">
        No lineage data for this asset.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/browse/${assetId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Asset
      </Link>

      <div>
        <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
          Lineage
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Ancestor and descendant relationships for this asset.
        </p>
      </div>

      <LineageTree data={lineage} assetId={assetId} />
    </div>
  );
}

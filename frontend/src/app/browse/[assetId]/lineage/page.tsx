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

  const { data: lineage, isLoading } = useQuery({
    queryKey: ["a2a", "asset", assetId, "lineage"],
    queryFn: () => apiClient.getAssetLineage(assetId),
  });

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

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !lineage ? (
        <p className="text-[var(--color-muted-foreground)]">
          Lineage data unavailable.
        </p>
      ) : lineage.nodes.length === 0 ? (
        <p className="py-8 text-center text-[var(--color-muted-foreground)]">
          No lineage data for this asset.
        </p>
      ) : (
        <LineageTree data={lineage} assetId={assetId} />
      )}
    </div>
  );
}

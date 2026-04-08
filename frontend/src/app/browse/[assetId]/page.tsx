"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { GDIRadarChart } from "@/components/charts/GDIRadarChart";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, ArrowDown, GitFork, Calendar } from "lucide-react";

function AssetTypeBadge({ type }: { type: string }) {
  const variant =
    type === "Gene" ? "gene" : type === "Capsule" ? "capsule" : "recipe";
  return <Badge variant={variant}>{type}</Badge>;
}

function GDIBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? "var(--color-gene-green)"
      : score >= 80
        ? "var(--color-capsule-blue)"
        : "var(--color-recipe-amber)";
  return (
    <div className="flex items-center gap-2">
      <span className="text-4xl font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
      <div className="flex flex-col text-xs text-[var(--color-muted-foreground)]">
        <span>GDI</span>
        <span>Score</span>
      </div>
    </div>
  );
}

function DetailPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const assetId = params.assetId as string;

  const { data: asset, isLoading, isError } = useQuery({
    queryKey: ["a2a", "asset", assetId],
    queryFn: () => apiClient.getAssetById(assetId),
  });

  if (isLoading) return <DetailPageSkeleton />;

  if (isError || !asset) {
    return (
      <div className="py-16 text-center">
        <p className="text-[var(--color-muted-foreground)]">
          Asset not found.
        </p>
        <Link href="/browse" className="mt-4 text-[var(--color-gene-green)]">
          Back to Browse
        </Link>
      </div>
    );
  }

  const gdi = normalizeGDI(asset.gdi_score);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/browse"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Browse
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <AssetTypeBadge type={asset.type} />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-foreground)]">
            {asset.name}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            by {asset.author_name ?? asset.author_id}
          </p>
        </div>
        <GDIBadge score={gdi.overall} />
      </div>

      {/* Description */}
      {asset.description && (
        <p className="text-[var(--color-muted-foreground)]">{asset.description}</p>
      )}

      {/* Signals */}
      <div className="flex flex-wrap gap-2">
        {asset.signals.map((s) => (
          <Badge key={s} variant="outline" className="font-mono text-xs">
            {s}
          </Badge>
        ))}
      </div>

      {/* GDI Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>GDI Dimensions</CardTitle>
        </CardHeader>
        <CardContent>
          <GDIRadarChart data={gdi} flat={gdi._flat} />
        </CardContent>
      </Card>

      {/* Meta info */}
      <div className="flex flex-wrap gap-6 text-sm text-[var(--color-muted-foreground)]">
        {asset.downloads != null && (
          <span className="flex items-center gap-1.5">
            <ArrowDown className="h-4 w-4" />
            {asset.downloads.toLocaleString()} downloads
          </span>
        )}
        <Link
          href={`/browse/${assetId}/lineage`}
          className="flex items-center gap-1.5 hover:text-[var(--color-gene-green)]"
        >
          <GitFork className="h-4 w-4" />
          View Lineage
        </Link>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {new Date(asset.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

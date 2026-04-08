"use client";

import Link from "next/link";
import type { Asset } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, GitFork } from "lucide-react";

interface AssetCardProps {
  asset: Asset;
}

function AssetTypeBadge({ type }: { type: Asset["type"] }) {
  const variant =
    type === "Gene"
      ? "gene"
      : type === "Capsule"
        ? "capsule"
        : type === "Recipe"
          ? "recipe"
          : "secondary";
  return <Badge variant={variant}>{type}</Badge>;
}

function GdiBadge({ gdi_score }: { gdi_score: Asset["gdi_score"] }) {
  const structured = normalizeGDI(gdi_score);
  const color =
    structured.overall >= 90
      ? "var(--color-gene-green)"
      : structured.overall >= 80
        ? "var(--color-capsule-blue)"
        : "var(--color-muted-foreground)";
  return (
    <span
      className="text-sm font-bold tabular-nums"
      style={{ color }}
    >
      {structured.overall}
    </span>
  );
}

export function AssetCard({ asset }: AssetCardProps) {
  return (
    <Link
      href={`/browse/${asset.asset_id}`}
      className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
            {asset.name}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            by {asset.author_name ?? asset.author_id}
          </p>
        </div>
        <AssetTypeBadge type={asset.type} />
      </div>

      {asset.description && (
        <p className="mb-3 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
          {asset.description}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {asset.signals.slice(0, 4).map((signal) => (
          <Badge key={signal} variant="outline" className="font-mono text-xs">
            {signal}
          </Badge>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
          <span className="flex items-center gap-1">
            <ArrowDown className="h-3 w-3" />
            {asset.downloads != null ? asset.downloads.toLocaleString() : "—"}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="h-3 w-3" />
            lineage
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--color-muted-foreground)]">GDI</span>
          <GdiBadge gdi_score={asset.gdi_score} />
        </div>
      </div>
    </Link>
  );
}

export function AssetCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex-1">
          <Skeleton className="mb-2 h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mb-3 h-3 w-full" />
      <Skeleton className="mb-3 h-3 w-5/6" />
      <div className="mb-3 flex gap-1.5">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  );
}

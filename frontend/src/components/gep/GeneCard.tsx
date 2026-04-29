"use client";

import Link from "next/link";
import { Gene, GeneCategory } from "@/lib/api/hooks/use-gep-types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Lightbulb, Zap, Search, GitFork } from "lucide-react";

interface GeneCardProps {
  gene: Gene;
  showNodeId?: boolean;
}

const categoryConfig: Record<
  GeneCategory,
  { label: string; icon: typeof CheckCircle; color: string }
> = {
  repair: {
    label: "Repair",
    icon: CheckCircle,
    color: "var(--color-capsule-blue)",
  },
  optimize: {
    label: "Optimize",
    icon: Zap,
    color: "var(--color-gene-green)",
  },
  innovate: {
    label: "Innovate",
    icon: Lightbulb,
    color: "var(--color-recipe-purple)",
  },
  explore: {
    label: "Explore",
    icon: Search,
    color: "var(--color-muted-foreground)",
  },
};

export function GeneCard({ gene, showNodeId = false }: GeneCardProps) {
  const config = categoryConfig[gene.category];
  const Icon = config.icon;

  return (
    <Link
      href={`/genes/${gene.id}`}
      className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon
            className="h-4 w-4 flex-shrink-0"
            style={{ color: config.color }}
          />
          <h3 className="truncate font-semibold text-[var(--color-foreground)] group-hover:text-[var(--color-gene-green)]">
            {gene.name}
          </h3>
        </div>
        <Badge
          variant="outline"
          className="flex-shrink-0 font-mono text-xs"
          style={{ borderColor: config.color, color: config.color }}
        >
          {config.label}
        </Badge>
      </div>

      {gene.description && (
        <p className="mb-3 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
          {gene.description}
        </p>
      )}

      {gene.validation && gene.validation.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-[var(--color-muted-foreground)]">
            Validation
          </p>
          <div className="flex flex-wrap gap-1">
            {gene.validation.slice(0, 3).map((v: string, i: number) => (
              <Badge
                key={i}
                variant="secondary"
                className="font-mono text-xs"
              >
                {v}
              </Badge>
            ))}
            {gene.validation.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{gene.validation.length - 3}
              </Badge>
            )}
          </div>
        </div>
      )}

      {gene.capability_profile && (
        <div className="mb-3 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
          <span>Level {gene.capability_profile.level}</span>
          <span>Rep {gene.capability_profile.reputation.toFixed(1)}</span>
          {gene.capability_profile.avg_confidence && (
            <span>
              Conf {gene.capability_profile.avg_confidence.toFixed(1)}%
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
          <GitFork className="h-3 w-3" />
          <span>Strategy: {gene.strategy.length} steps</span>
        </div>
        {showNodeId ? (() => { const nid = gene.metadata?.node_id as string | undefined; return nid ? <span className="truncate text-xs text-[var(--color-muted-foreground)]">Node: {nid.slice(0, 8)}...</span> : null; })() : null}
      </div>
    </Link>
  );
}

export function GeneCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="mb-3 h-3 w-5/6" />
      <Skeleton className="mb-3 h-3 w-1/2" />
      <div className="mb-3 flex gap-1.5">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

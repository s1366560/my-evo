"use client";

import { X, ExternalLink, Star } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { MapNode } from "@/lib/hooks/use-map-data";

interface MapNodePanelProps {
  node: MapNode | null;
  onClose: () => void;
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  Gene: { label: "Gene", color: "bg-[color-mix(in_oklab,var(--color-gene-green)_15%,transparent)] text-[var(--color-gene-green)] border border-[color-mix(in_oklab,var(--color-gene-green)_30%,transparent)]" },
  Capsule: { label: "Capsule", color: "bg-[color-mix(in_oklab,var(--color-capsule-blue)_15%,transparent)] text-[var(--color-capsule-blue)] border border-[color-mix(in_oklab,var(--color-capsule-blue)_30%,transparent)]" },
  Recipe: { label: "Recipe", color: "bg-[color-mix(in_oklab,var(--color-recipe-amber)_15%,transparent)] text-[var(--color-recipe-amber)] border border-[color-mix(in_oklab,var(--color-recipe-amber)_30%,transparent)]" },
  Organism: { label: "Organism", color: "bg-[color-mix(in_oklab,#a855f7_15%,transparent)] text-[#a855f7] border border-[color-mix(in_oklab,#a855f7_30%,transparent)]" },
};

export function MapNodePanel({ node, onClose }: MapNodePanelProps) {
  if (!node) return null;

  const badge = TYPE_BADGE[node.type] ?? { label: node.type, color: "bg-muted text-muted-foreground" };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <h3 className="truncate text-sm font-semibold text-[var(--color-card-foreground)]">
            {node.name}
          </h3>
          {node.author_name && (
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              by {node.author_name}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-foreground)]"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* GDI Score */}
      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-background)] px-3 py-2">
        <Star className="h-3.5 w-3.5 text-[var(--color-gene-green)]" />
        <span className="text-xs font-semibold text-[var(--color-card-foreground)]">
          GDI Score
        </span>
        <span className="ml-auto text-sm font-bold text-[var(--color-gene-green)]">
          {node.gdi_score.toFixed(2)}
        </span>
      </div>

      {/* Node ID */}
      <div className="mt-2 space-y-1">
        <p className="text-xs text-[var(--color-muted-foreground)]">Node ID</p>
        <p className="truncate rounded-md bg-[var(--color-muted-background)] px-2 py-1 font-mono text-xs text-[var(--color-muted-foreground)]">
          {node.id}
        </p>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button asChild size="sm" className="flex-1 text-xs">
          <Link href={`/browse/${node.id}`}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View Asset
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="flex-1 text-xs">
          <Link href={`/browse/${node.id}/lineage`}>
            View Lineage
          </Link>
        </Button>
      </div>
    </div>
  );
}

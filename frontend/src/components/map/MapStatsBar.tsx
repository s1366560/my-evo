"use client";

import { Globe, GitBranch, Activity } from "lucide-react";
import type { MapGraph } from "@/lib/hooks/use-map-data";

interface MapStatsBarProps {
  stats: MapGraph["stats"];
  selectedType?: string;
  onTypeFilter?: (type: string) => void;
}

export function MapStatsBar({ stats, selectedType, onTypeFilter }: MapStatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] px-4 py-3">
      <StatPill
        icon={<Globe className="h-3.5 w-3.5" />}
        label="Total Nodes"
        value={stats.totalNodes}
        active={!selectedType}
        onClick={() => onTypeFilter?.("all")}
      />
      <StatPill
        icon={<GitBranch className="h-3.5 w-3.5" />}
        label="Edges"
        value={stats.totalEdges}
        active={false}
      />
      <StatPill
        icon={<Activity className="h-3.5 w-3.5" />}
        label="Avg GDI"
        value={stats.avgGdi}
        active={false}
        suffix=""
      />

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTypeFilter?.("Gene")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedType === "Gene"
              ? "bg-[color-mix(in_oklab,var(--color-gene-green)_18%,transparent)] text-[var(--color-gene-green)] border border-[color-mix(in_oklab,var(--color-gene-green)_40%,transparent)]"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] hover:bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)]"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--color-gene-green)]" />
          Genes ({stats.geneCount})
        </button>
        <button
          type="button"
          onClick={() => onTypeFilter?.("Capsule")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedType === "Capsule"
              ? "bg-[color-mix(in_oklab,var(--color-capsule-blue)_18%,transparent)] text-[var(--color-capsule-blue)] border border-[color-mix(in_oklab,var(--color-capsule-blue)_40%,transparent)]"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] hover:bg-[color-mix(in_oklab,var(--color-capsule-blue)_10%,transparent)]"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--color-capsule-blue)]" />
          Capsules ({stats.capsuleCount})
        </button>
        <button
          type="button"
          onClick={() => onTypeFilter?.("Recipe")}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            selectedType === "Recipe"
              ? "bg-[color-mix(in_oklab,var(--color-recipe-amber)_18%,transparent)] text-[var(--color-recipe-amber)] border border-[color-mix(in_oklab,var(--color-recipe-amber)_40%,transparent)]"
              : "bg-[var(--color-surface-muted)] text-[var(--color-muted-foreground)] hover:bg-[color-mix(in_oklab,var(--color-recipe-amber)_10%,transparent)]"
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-[var(--color-recipe-amber)]" />
          Recipes ({stats.recipeCount})
        </button>
      </div>
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
  active,
  onClick,
  suffix = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  onClick?: () => void;
  suffix?: string;
}) {
  const className = `flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-colors ${
    active && onClick
      ? "bg-[color-mix(in_oklab,var(--color-gene-green)_10%,transparent)] text-[var(--color-foreground)] cursor-pointer"
      : "text-[var(--color-muted-foreground)]"
  } ${onClick ? "hover:bg-[var(--color-surface-muted)] cursor-pointer" : ""}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {icon}
        <span>{label}</span>
        <span className="font-semibold text-[var(--color-foreground)]">
          {typeof value === "number" && !Number.isInteger(value)
            ? value.toFixed(1)
            : value.toLocaleString()}
          {suffix}
        </span>
      </button>
    );
  }

  return (
    <div className={className}>
      {icon}
      <span>{label}</span>
      <span className="font-semibold text-[var(--color-foreground)]">
        {typeof value === "number" && !Number.isInteger(value)
          ? value.toFixed(1)
          : value.toLocaleString()}
        {suffix}
      </span>
    </div>
  );
}

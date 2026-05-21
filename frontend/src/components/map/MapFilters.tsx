"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MapFilters as MapFiltersType } from "@/lib/hooks/use-map-data";

interface MapFiltersProps {
  value: MapFiltersType;
  onChange: (filters: MapFiltersType) => void;
  stats?: {
    totalNodes: number;
    geneCount: number;
    capsuleCount: number;
    recipeCount: number;
    avgGdi: number;
  };
}

const TYPE_OPTIONS = [
  { label: "All Types", value: "all" },
  { label: "Genes", value: "Gene" },
  { label: "Capsules", value: "Capsule" },
  { label: "Recipes", value: "Recipe" },
  { label: "Organisms", value: "Organism" },
];

export function MapFilters({ value, onChange, stats }: MapFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.search ?? "");

  const handleTypeChange = (type: string) => {
    onChange({ ...value, type: type === "all" ? undefined : (type as MapFiltersType["type"]) });
  };

  const handleMinGdiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    onChange({ ...value, minGdi: v > 0 ? v : undefined });
  };

  const handleSearch = () => {
    onChange({ ...value, search: searchInput || undefined });
  };

  const clearFilters = () => {
    setSearchInput("");
    onChange({});
  };

  const hasActiveFilters = value.type || value.minGdi || value.search;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-card-foreground)]">Filters</p>
        {stats && (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {stats.totalNodes} nodes · avg GDI {stats.avgGdi}
          </p>
        )}
      </div>

      {/* Type filter */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[var(--color-muted-foreground)]">Asset Type</label>
        <Select value={value.type ?? "all"} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Min GDI filter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
            Min GDI Score
          </label>
          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {value.minGdi ?? 0}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.minGdi ?? 0}
          onChange={handleMinGdiChange}
          className="w-full accent-[var(--color-gene-green)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] pl-8 pr-3 text-xs text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-gene-green)]"
          />
        </div>
        <Button size="sm" variant="outline" onClick={handleSearch} className="h-8 px-2.5">
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Clear */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex w-full items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <X className="h-3 w-3" />
          Clear filters
        </button>
      )}

      {/* Type legend */}
      {stats && (
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { label: "Genes", count: stats.geneCount, color: "#22c55e" },
            { label: "Capsules", count: stats.capsuleCount, color: "#3b82f6" },
            { label: "Recipes", count: stats.recipeCount, color: "#f59e0b" },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-[var(--color-muted-foreground)]">
                {label} ({count})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

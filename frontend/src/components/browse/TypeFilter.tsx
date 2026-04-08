"use client";

import { cn } from "@/lib/utils";
import type { AssetType } from "@/lib/api/client";

const TYPES: { label: string; value: AssetType | "All" }[] = [
  { label: "All", value: "All" },
  { label: "Genes", value: "Gene" },
  { label: "Capsules", value: "Capsule" },
  { label: "Recipes", value: "Recipe" },
];

interface TypeFilterProps {
  selected: AssetType | "All";
  onChange: (type: AssetType | "All") => void;
}

export function TypeFilter({ selected, onChange }: TypeFilterProps) {
  return (
    <div className="flex gap-2">
      {TYPES.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            selected === value
              ? "bg-[var(--color-gene-green)] text-white"
              : "bg-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-border)]/80 hover:text-[var(--color-foreground)]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

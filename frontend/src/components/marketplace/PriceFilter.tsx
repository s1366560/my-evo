"use client";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type AssetType = "Gene" | "Capsule" | "Recipe";

interface PriceFilterProps {
  priceRange: { min: number; max: number };
  onPriceRangeChange: (range: { min: number; max: number }) => void;
  selectedTypes: Set<AssetType>;
  onTypesChange: (types: Set<AssetType>) => void;
}

const allTypes: AssetType[] = ["Gene", "Capsule", "Recipe"];

const typeColors: Record<AssetType, string> = {
  Gene: "var(--color-gene-green)",
  Capsule: "var(--color-capsule-blue)",
  Recipe: "var(--color-recipe-amber)",
};

export function PriceFilter({
  priceRange,
  onPriceRangeChange,
  selectedTypes,
  onTypesChange,
}: PriceFilterProps) {
  const toggleType = (type: AssetType) => {
    const next = new Set(selectedTypes);
    if (next.has(type)) {
      next.delete(type);
    } else {
      next.add(type);
    }
    onTypesChange(next);
  };

  return (
    <Card className="bg-[var(--color-card-background)]">
      <CardContent className="flex flex-wrap items-center gap-6 p-4">
        {/* Price Range */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
            Price:
          </span>
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={priceRange.min || ""}
            onChange={(e) =>
              onPriceRangeChange({
                ...priceRange,
                min: Number(e.target.value) || 0,
              })
            }
            className="w-24"
          />
          <span className="text-[var(--color-muted-foreground)]">-</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={priceRange.max || ""}
            onChange={(e) =>
              onPriceRangeChange({
                ...priceRange,
                max: Number(e.target.value) || 1000,
              })
            }
            className="w-24"
          />
          <span className="text-sm text-[var(--color-muted-foreground)]">
            credits
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--color-border)]" />

        {/* Type Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[var(--color-muted-foreground)]">
            Type:
          </span>
          {allTypes.map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-1.5 text-sm font-medium"
            >
              <input
                type="checkbox"
                checked={selectedTypes.has(type)}
                onChange={() => toggleType(type)}
                className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-ring)]"
              />
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: typeColors[type] }}
              >
                {type}
              </span>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

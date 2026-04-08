"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpeciesCard } from "./SpeciesCard";

interface SpeciesStats {
  name: string;
  count: number;
  avgGDI: number;
}

interface GenePoolStatsProps {
  stats: {
    totalGenes: number;
    avgGDI: number;
    diversityIndex: number;
    topSpecies: SpeciesStats[];
  };
}

export function GenePoolStats({ stats }: GenePoolStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gene Pool Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics grid */}
        <div className="grid grid-cols-3 gap-3">
          <MetricBlock
            label="Total Genes"
            value={stats.totalGenes}
            color="var(--color-gene-green)"
          />
          <MetricBlock
            label="Avg GDI"
            value={stats.avgGDI}
            color="var(--color-capsule-blue)"
            isFloat
          />
          <MetricBlock
            label="Diversity"
            value={stats.diversityIndex}
            color="var(--color-recipe-amber)"
            isFloat
            suffix=""
            maxVal={1}
          />
        </div>

        {/* Diversity bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-muted-foreground)]">
              Gene Diversity Index
            </span>
            <span
              className="font-medium tabular-nums"
              style={{ color: "var(--color-recipe-amber)" }}
            >
              {(stats.diversityIndex * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${stats.diversityIndex * 100}%`,
                backgroundColor: "var(--color-recipe-amber)",
              }}
            />
          </div>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Based on Shannon entropy across species distribution
          </p>
        </div>

        {/* Top species */}
        <div className="space-y-2 pt-2">
          <h3 className="text-sm font-medium text-[var(--color-foreground)]">
            Top Species by Count
          </h3>
          <div className="space-y-2">
            {stats.topSpecies.slice(0, 3).map((species) => (
              <SpeciesCard key={species.name} species={species} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricBlockProps {
  label: string;
  value: number;
  color: string;
  isFloat?: boolean;
  suffix?: string;
  maxVal?: number;
}

function MetricBlock({
  label,
  value,
  color,
  isFloat,
  suffix,
  maxVal,
}: MetricBlockProps) {
  const displayValue = isFloat
    ? (maxVal ? (value * 100).toFixed(1) : value.toFixed(1))
    : value.toString();
  const displaySuffix = suffix ?? (maxVal ? "%" : "");

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-center">
      <div
        className="text-xl font-bold tabular-nums"
        style={{ color }}
      >
        {displayValue}
        {displaySuffix}
      </div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
    </div>
  );
}

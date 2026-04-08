"use client";

import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/PageContainer";
import { GenePoolStats } from "@/components/biology/GenePoolStats";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";
import type { ApiStats, Asset, FitnessLandscape } from "@/lib/api/client";

function BiologySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-[480px]" />
      </div>
    </div>
  );
}

function FitnessLandscapeGrid({ grid }: {
  grid: Array<Array<{ row: number; col: number; label: string; count: number; avg_gdi: number }>>
}) {
  if (!grid || grid.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center text-[var(--color-muted-foreground)]">
        No fitness data available
      </div>
    );
  }
  const getColor = (gdi: number, count: number) => {
    if (count === 0) return "var(--color-border)";
    if (gdi >= 85) return "color-mix(in srgb, var(--color-gene-green) 80%, transparent)";
    if (gdi >= 70) return "color-mix(in srgb, var(--color-capsule-blue) 70%, transparent)";
    if (gdi >= 50) return "color-mix(in srgb, var(--color-recipe-amber) 60%, transparent)";
    return "color-mix(in srgb, var(--color-destructive) 50%, transparent)";
  };
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
        Fitness Landscape (GDI vs Downloads)
      </h3>
      <div className="grid grid-cols-5 gap-1">
        {grid.flat().map((cell, i) => (
          <div
            key={i}
            className="aspect-square rounded flex items-center justify-center text-[10px] text-white font-medium cursor-default"
            style={{ backgroundColor: getColor(cell.avg_gdi, cell.count) }}
            title={`${cell.label}: ${cell.count} assets, avg GDI ${cell.avg_gdi.toFixed(1)}`}
          >
            {cell.count > 0 ? cell.count : ""}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-muted-foreground)]">
        <span className="font-medium">GDI ↓</span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--color-gene-green) 80%, transparent)" }} />
          <span>High (85+)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--color-capsule-blue) 70%, transparent)" }} />
          <span>Medium (70+)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--color-recipe-amber) 60%, transparent)" }} />
          <span>Low (50+)</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--color-destructive) 50%, transparent)" }} />
          <span>Very Low</span>
        </span>
      </div>
    </div>
  );
}

function GeneDistribution({ assets }: { assets: Asset[] }) {
  const counts = assets.reduce<Record<string, number>>((acc, a) => {
    const t = a.type;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const total = assets.length || 1;
  const colors: Record<string, string> = {
    Gene: "var(--color-gene-green)",
    Capsule: "var(--color-capsule-blue)",
    Recipe: "var(--color-recipe-amber)",
    Organism: "color-mix(in srgb, var(--color-organism-purple, #a855f7) 100%, transparent)",
  };
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-foreground)]">
        Asset Distribution
      </h3>
      <div className="space-y-2">
        {Object.entries(counts).map(([type, count]) => (
          <div key={type} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[type] ?? "var(--color-border)" }} />
            <span className="flex-1 text-xs text-[var(--color-muted-foreground)]">{type}</span>
            <span className="text-xs font-medium text-[var(--color-foreground)]">{count}</span>
            <div className="h-2 w-24 rounded-full bg-[var(--color-border)]">
              <div
                className="h-2 rounded-full will-change-transform"
                style={{
                  transform: `scaleX(${count / total})`,
                  transformOrigin: "left",
                  backgroundColor: `color-mix(in srgb, ${colors[type] ?? "var(--color-border)"} 100%, transparent)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BiologyPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<ApiStats>({
    queryKey: ["biology", "stats"],
    queryFn: () => apiClient.getStats(),
  });

  const { data: assetsRaw } = useQuery<Asset[]>({
    queryKey: ["biology", "assets"],
    queryFn: () => apiClient.getAssets(),
  });

  const { data: fitnessResult, isError: fitnessError } = useQuery({
    queryKey: ["biology", "fitness"],
    queryFn: () => apiClient.getBiologyFitness(),
  });

  if (statsLoading || !stats) {
    return (
      <PageContainer>
        <BiologySkeleton />
      </PageContainer>
    );
  }

  const assets: Asset[] = assetsRaw ?? [];
  const fitnessData = fitnessResult as FitnessLandscape | undefined;
  const grid = fitnessData?.grid;

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="mb-1 text-3xl font-bold text-[var(--color-foreground)]">
            Ecosystem Biology
          </h1>
          <p className="text-[var(--color-muted-foreground)]">
            Explore the evolutionary landscape of the EvoMap ecosystem — organism
            relationships, fitness distribution, and gene diversity metrics.
          </p>
        </div>

        {/* Network stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatPill label="Total Nodes" value={stats.total_nodes} />
          <StatPill label="Alive Nodes" value={stats.alive_nodes} />
          <StatPill label="Genes" value={stats.total_genes} />
          <StatPill label="Active Swarms" value={stats.active_swarms ?? 0} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {assets.length > 0 ? (
              <GeneDistribution assets={assets} />
            ) : (
              <GenePoolStats
                stats={{
                  totalGenes: stats.total_genes,
                  avgGDI: 50,
                  diversityIndex: 0,
                  topSpecies: [],
                }}
              />
            )}
          </div>

          <div className="space-y-6">
            {grid ? (
              <FitnessLandscapeGrid grid={grid} />
            ) : fitnessError ? (
              <div className="flex h-[480px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] text-[var(--color-muted-foreground)]">
                Fitness data unavailable
              </div>
            ) : (
              <div className="flex h-[480px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-gene-green)]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card-background)] p-4 text-center">
      <div className="text-2xl font-bold text-[var(--color-gene-green)]">{value}</div>
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { PageContainer } from "@/components/layout/PageContainer";
import { PhylogeneticTree } from "@/components/biology/PhylogeneticTree";
import { FitnessLandscape } from "@/components/biology/FitnessLandscape";
import { GenePoolStats } from "@/components/biology/GenePoolStats";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";

const mockGenePoolStats = {
  totalGenes: 0,
  avgGDI: 0,
  diversityIndex: 0,
  topSpecies: [],
};

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
        <Skeleton className="h-[520px]" />
        <Skeleton className="h-[480px]" />
      </div>
    </div>
  );
}

export default function BiologyPage() {
  // Fetch stats for the stat pills
  const { data: stats } = useQuery({
    queryKey: ["biology", "stats"],
    queryFn: () => apiClient.getStats(),
  });

  // Fetch first asset to get an assetId for phylogeny
  const { data: assetsData } = useQuery({
    queryKey: ["biology", "assets"],
    queryFn: () => apiClient.getAssets(),
  });

  // Fetch phylogeny tree for the first asset
  const { data: phylogenyData } = useQuery({
    queryKey: ["biology", "phylogeny"],
    queryFn: () => apiClient.getBiologyPhylogeny(assetsData?.assets[0]?.asset_id ?? ""),
    enabled: !!assetsData?.assets[0]?.asset_id,
  });

  // Fetch fitness landscape
  const { data: fitnessData } = useQuery({
    queryKey: ["biology", "fitness"],
    queryFn: () => apiClient.getBiologyFitness(),
  });

  if (!stats || !phylogenyData || !fitnessData) {
    return (
      <PageContainer>
        <BiologySkeleton />
      </PageContainer>
    );
  }

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

        {/* Stats summary */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatPill label="Total Nodes" value={stats.total_nodes} />
          <StatPill label="Alive Nodes" value={stats.alive_nodes} />
          <StatPill label="Genes" value={stats.total_genes} />
          <StatPill label="Active Swarms" value={stats.active_swarms} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-6">
            <PhylogeneticTree
              data={phylogenyData}
              assetId={assetsData?.assets[0]?.asset_id ?? ""}
            />
            <GenePoolStats stats={mockGenePoolStats} />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <FitnessLandscape data={fitnessData.data} />
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

"use client";

import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PhylogeneticTree } from "@/components/biology/PhylogeneticTree";
import { FitnessLandscape } from "@/components/biology/FitnessLandscape";
import { GenePoolStats } from "@/components/biology/GenePoolStats";
import { Skeleton } from "@/components/ui/skeleton";

// Mock phylogenetic data (represents organism/gene relationships)
const mockPhylogeneticNodes = [
  { asset_id: "gene-001", name: "Security Shield", type: "Gene" as const, parent_id: undefined, gdi_score: 78 },
  { asset_id: "gene-002", name: "Auth Manager", type: "Gene" as const, parent_id: "gene-001", gdi_score: 82 },
  { asset_id: "gene-003", name: "Token Validator", type: "Gene" as const, parent_id: "gene-002", gdi_score: 75 },
  { asset_id: "gene-004", name: "OAuth Bridge", type: "Gene" as const, parent_id: "gene-002", gdi_score: 88 },
  { asset_id: "capsule-001", name: "Secure Capsule", type: "Capsule" as const, parent_id: "gene-001", gdi_score: 85 },
  { asset_id: "recipe-001", name: "Auth Stack", type: "Recipe" as const, parent_id: "gene-002", gdi_score: 91 },
  { asset_id: "gene-005", name: "NLP Processor", type: "Gene" as const, parent_id: undefined, gdi_score: 72 },
  { asset_id: "gene-006", name: "Token Extractor", type: "Gene" as const, parent_id: "gene-005", gdi_score: 79 },
  { asset_id: "gene-007", name: "Sentiment Analyzer", type: "Gene" as const, parent_id: "gene-005", gdi_score: 83 },
  { asset_id: "capsule-002", name: "Text Processor", type: "Capsule" as const, parent_id: "gene-005", gdi_score: 80 },
  { asset_id: "gene-008", name: "Vision Core", type: "Gene" as const, parent_id: undefined, gdi_score: 68 },
  { asset_id: "gene-009", name: "Image Classifier", type: "Gene" as const, parent_id: "gene-008", gdi_score: 74 },
  { asset_id: "gene-010", name: "Object Detector", type: "Gene" as const, parent_id: "gene-008", gdi_score: 77 },
  { asset_id: "capsule-003", name: "Vision Capsule", type: "Capsule" as const, parent_id: "gene-008", gdi_score: 81 },
  { asset_id: "recipe-002", name: "Vision Pipeline", type: "Recipe" as const, parent_id: "gene-008", gdi_score: 86 },
  { asset_id: "gene-011", name: "Reasoning Engine", type: "Gene" as const, parent_id: undefined, gdi_score: 90 },
  { asset_id: "gene-012", name: "Logic Solver", type: "Gene" as const, parent_id: "gene-011", gdi_score: 87 },
  { asset_id: "gene-013", name: "Planner Agent", type: "Gene" as const, parent_id: "gene-011", gdi_score: 92 },
  { asset_id: "capsule-004", name: "Reasoning Capsule", type: "Capsule" as const, parent_id: "gene-011", gdi_score: 89 },
  { asset_id: "recipe-003", name: "Agent Blueprint", type: "Recipe" as const, parent_id: "gene-011", gdi_score: 94 },
  { asset_id: "gene-014", name: "Memory System", type: "Gene" as const, parent_id: undefined, gdi_score: 76 },
  { asset_id: "gene-015", name: "Cache Manager", type: "Gene" as const, parent_id: "gene-014", gdi_score: 71 },
  { asset_id: "gene-016", name: "Graph Store", type: "Gene" as const, parent_id: "gene-014", gdi_score: 84 },
  { asset_id: "capsule-005", name: "Memory Capsule", type: "Capsule" as const, parent_id: "gene-014", gdi_score: 78 },
  { asset_id: "recipe-004", name: "Agent Memory", type: "Recipe" as const, parent_id: "gene-014", gdi_score: 83 },
  { asset_id: "gene-017", name: "API Gateway", type: "Gene" as const, parent_id: undefined, gdi_score: 65 },
  { asset_id: "gene-018", name: "Rate Limiter", type: "Gene" as const, parent_id: "gene-017", gdi_score: 70 },
  { asset_id: "gene-019", name: "Load Balancer", type: "Gene" as const, parent_id: "gene-017", gdi_score: 73 },
];

const mockPhylogeneticEdges = mockPhylogeneticNodes
  .filter((n) => n.parent_id)
  .map((n) => ({ from: n.parent_id!, to: n.asset_id }));

const mockGenePoolStats = {
  totalGenes: 247,
  avgGDI: 78.4,
  diversityIndex: 0.73,
  topSpecies: [
    { name: "Security Genes", count: 42, avgGDI: 81.2 },
    { name: "NLP Genes", count: 38, avgGDI: 76.8 },
    { name: "Reasoning Genes", count: 31, avgGDI: 88.5 },
    { name: "Vision Genes", count: 28, avgGDI: 74.3 },
    { name: "Memory Genes", count: 24, avgGDI: 77.1 },
  ],
};

const mockFitnessData = [
  { novelty: 20, usefulness: 15, rigor: 30, gdi: 18 },
  { novelty: 35, usefulness: 28, rigor: 45, gdi: 38 },
  { novelty: 50, usefulness: 42, rigor: 60, gdi: 55 },
  { novelty: 65, usefulness: 58, rigor: 55, gdi: 62 },
  { novelty: 80, usefulness: 72, rigor: 70, gdi: 78 },
  { novelty: 45, usefulness: 65, rigor: 80, gdi: 68 },
  { novelty: 55, usefulness: 48, rigor: 40, gdi: 48 },
  { novelty: 70, usefulness: 82, rigor: 75, gdi: 82 },
  { novelty: 30, usefulness: 22, rigor: 35, gdi: 28 },
  { novelty: 85, usefulness: 78, rigor: 90, gdi: 88 },
  { novelty: 40, usefulness: 55, rigor: 65, gdi: 58 },
  { novelty: 60, usefulness: 70, rigor: 50, gdi: 63 },
  { novelty: 25, usefulness: 30, rigor: 25, gdi: 24 },
  { novelty: 75, usefulness: 65, rigor: 85, gdi: 76 },
  { novelty: 90, usefulness: 88, rigor: 95, gdi: 92 },
  { novelty: 15, usefulness: 18, rigor: 20, gdi: 15 },
  { novelty: 48, usefulness: 52, rigor: 58, gdi: 54 },
  { novelty: 68, usefulness: 60, rigor: 72, gdi: 68 },
  { novelty: 82, usefulness: 85, rigor: 80, gdi: 84 },
  { novelty: 38, usefulness: 35, rigor: 42, gdi: 36 },
  { novelty: 58, usefulness: 62, rigor: 55, gdi: 60 },
  { novelty: 72, usefulness: 68, rigor: 78, gdi: 74 },
  { novelty: 88, usefulness: 80, rigor: 88, gdi: 86 },
  { novelty: 32, usefulness: 40, rigor: 38, gdi: 38 },
  { novelty: 52, usefulness: 45, rigor: 52, gdi: 50 },
  { novelty: 78, usefulness: 75, rigor: 82, gdi: 80 },
  { novelty: 42, usefulness: 50, rigor: 48, gdi: 46 },
  { novelty: 62, usefulness: 55, rigor: 68, gdi: 64 },
  { novelty: 95, usefulness: 90, rigor: 98, gdi: 96 },
  { novelty: 28, usefulness: 25, rigor: 32, gdi: 26 },
];

function BiologySkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="mb-2 h-9 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-[480px]" />
      </div>
    </div>
  );
}

export default function BiologyPage() {
  const [isLoading] = useState(true);

  const phylogeneticData = {
    nodes: mockPhylogeneticNodes,
    edges: mockPhylogeneticEdges,
  };

  if (isLoading) {
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
          <StatPill label="Total Nodes" value={247} />
          <StatPill label="Alive Nodes" value={198} />
          <StatPill label="Genes" value={247} />
          <StatPill label="Active Swarms" value={12} />
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-6">
            <PhylogeneticTree
              data={phylogeneticData}
              assetId=""
            />
            <GenePoolStats stats={mockGenePoolStats} />
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <FitnessLandscape data={mockFitnessData} />
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

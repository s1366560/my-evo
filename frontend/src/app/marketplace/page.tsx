"use client";

import { useState } from "react";
import { PriceFilter } from "@/components/marketplace/PriceFilter";
import { AssetListingCard } from "@/components/marketplace/AssetListingCard";

type AssetType = "Gene" | "Capsule" | "Recipe";

interface MockAsset {
  id: string;
  name: string;
  type: AssetType;
  price: number;
  seller: string;
  gdiScore: number;
}

const mockAssets: MockAsset[] = [
  { id: "1", name: "ContextAssembler", type: "Gene", price: 50, seller: "NeuroCore", gdiScore: 91 },
  { id: "2", name: "RLHF-Pipeline", type: "Capsule", price: 120, seller: "SynthLab", gdiScore: 88 },
  { id: "3", name: "MultiHopReasoner", type: "Recipe", price: 80, seller: "DeepThink", gdiScore: 95 },
  { id: "4", name: "PromptOptimizer-v2", type: "Gene", price: 35, seller: "PromptWiz", gdiScore: 82 },
  { id: "5", name: "CodeSynthAgent", type: "Capsule", price: 200, seller: "CodeForge", gdiScore: 97 },
  { id: "6", name: "VisionEncoder", type: "Gene", price: 75, seller: "PixelMind", gdiScore: 86 },
  { id: "7", name: "MathSolver-Pro", type: "Recipe", price: 150, seller: "NumLogic", gdiScore: 93 },
  { id: "8", name: "SecurityScanner", type: "Capsule", price: 90, seller: "SecuPath", gdiScore: 79 },
  { id: "9", name: "TextSummarizer", type: "Gene", price: 25, seller: "TextAI", gdiScore: 84 },
  { id: "10", name: "DataAugmentor", type: "Recipe", price: 60, seller: "DataForge", gdiScore: 81 },
  { id: "11", name: "NLU-Enhanced", type: "Gene", price: 40, seller: "Linguist", gdiScore: 89 },
  { id: "12", name: "InferenceEngine", type: "Capsule", price: 180, seller: "FastMind", gdiScore: 96 },
];

export default function MarketplacePage() {
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 1000,
  });
  const [selectedTypes, setSelectedTypes] = useState<Set<AssetType>>(
    new Set(["Gene", "Capsule", "Recipe"])
  );

  const filtered = mockAssets.filter(
    (a) =>
      a.price >= priceRange.min &&
      a.price <= priceRange.max &&
      selectedTypes.has(a.type)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Asset Marketplace
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Buy and sell Genes, Capsules, and Recipes from the EvoMap community.
        </p>
      </div>

      {/* Filters */}
      <PriceFilter
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
      />

      {/* Asset Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((asset) => (
          <AssetListingCard key={asset.id} asset={asset} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-[var(--color-muted-foreground)]">
            No assets match your filters.
          </div>
        )}
      </div>
    </div>
  );
}

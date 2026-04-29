"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PriceFilter } from "@/components/marketplace/PriceFilter";
import { AssetListingCard } from "@/components/marketplace/AssetListingCard";
import { apiClient, MarketplaceListing } from "@/lib/api/client";
import { Skeleton } from "@/components/ui/skeleton";

type AssetType = "Gene" | "Capsule" | "Recipe";

interface MappedAsset {
  id: string;
  name: string;
  type: AssetType;
  price: number;
  seller: string;
  gdiScore: number;
}

function mapListing(l: MarketplaceListing): MappedAsset {
  return {
    id: l.listing_id,
    name: l.asset_name,
    type: l.asset_type,
    price: l.price,
    seller: l.seller,
    gdiScore: l.gdi_score ?? 0,
  };
}

export default function MarketplacePage() {
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({
    min: 0,
    max: 1000,
  });
  const [selectedTypes, setSelectedTypes] = useState<Set<AssetType>>(
    new Set(["Gene", "Capsule", "Recipe"])
  );

  const { data: result, isLoading, isError } = useQuery({
    queryKey: ["marketplace-listings"],
    queryFn: () => apiClient.getMarketplaceListings(),
  });

  const listings = (result as { data?: MarketplaceListing[] } | null)?.data ?? [];
  const assets = listings.map(mapListing);

  const filtered = assets.filter(
    (a) =>
      a.price >= priceRange.min &&
      a.price <= priceRange.max &&
      selectedTypes.has(a.type)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Asset Marketplace
        </h1>
        <p className="text-[var(--color-muted-foreground)]">
          Buy and sell Genes, Capsules, and Recipes from the EvoMap community.
        </p>
      </div>

      <PriceFilter
        priceRange={priceRange}
        onPriceRangeChange={setPriceRange}
        selectedTypes={selectedTypes}
        onTypesChange={setSelectedTypes}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading &&
          [1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
          ))}

        {isError && (
          <div className="col-span-full rounded-xl border border-[var(--color-destructive)] bg-[var(--color-destructive)]/5 p-6 text-center text-sm text-[var(--color-destructive)]">
            Failed to load marketplace listings. Please try again later.
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-[var(--color-muted-foreground)]">
            No assets match your filters.
          </div>
        )}

        {!isLoading &&
          !isError &&
          filtered.map((asset) => (
            <AssetListingCard key={asset.id} asset={asset} />
          ))}
      </div>
    </div>
  );
}

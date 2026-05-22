"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";

type AssetType = "Gene" | "Capsule" | "Recipe";

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  description: string;
  price: number;
  seller: string;
  gdiScore: number;
  tags: string[];
  lineage?: {
    ancestors: string[];
    descendants: string[];
  };
}

interface AssetDetailProps {
  assetId: string;
}

function AssetHeader({ asset }: { asset: Asset }) {
  const typeVariants: Record<AssetType, string> = {
    Gene: "gene",
    Capsule: "capsule",
    Recipe: "recipe",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <Badge variant={typeVariants[asset.type] as "gene" | "capsule" | "recipe"}>
            {asset.type}
          </Badge>
          <h1 className="mt-2 text-3xl font-bold">{asset.name}</h1>
          <p className="mt-1 text-[var(--color-muted-foreground)]">
            by {asset.seller}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{asset.price} Credits</div>
          <div className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            GDI Score: {asset.gdiScore}
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetDescription({ description, tags }: { description: string; tags: string[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Description</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap">{description}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AssetLineage({ lineage }: { lineage: Asset["lineage"] }) {
  if (!lineage) return null;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Lineage</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {lineage.ancestors.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
              Ancestors
            </h3>
            <div className="flex flex-wrap gap-2">
              {lineage.ancestors.map((ancestor) => (
                <Badge key={ancestor} variant="outline">
                  {ancestor}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {lineage.descendants.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
              Descendants
            </h3>
            <div className="flex flex-wrap gap-2">
              {lineage.descendants.map((descendant) => (
                <Badge key={descendant} variant="outline">
                  {descendant}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {lineage.ancestors.length === 0 && lineage.descendants.length === 0 && (
          <p className="text-[var(--color-muted-foreground)]">No lineage data available</p>
        )}
      </CardContent>
    </Card>
  );
}

function AssetPurchase({ assetId, price }: { assetId: string; price: number }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Purchase</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-2xl font-bold">{price} Credits</div>
        <Button className="w-full" size="lg">
          Buy Now
        </Button>
        <Button variant="outline" className="w-full">
          Add to Cart
        </Button>
      </CardContent>
    </Card>
  );
}

export function AssetDetail({ assetId }: AssetDetailProps) {
  const { data: asset, isLoading, isError } = useQuery<Asset>({
    queryKey: ["asset", assetId],
    queryFn: async () => {
      // Mock data for demo - in production this would call the API
      return {
        id: assetId,
        name: "Evolutionary Gene Alpha",
        type: "Gene" as AssetType,
        description: "An advanced evolutionary gene that enables rapid adaptation to new environments. This gene has been optimized through multiple generations of selective breeding and mutation testing.",
        price: 150,
        seller: "EvolutionLab",
        gdiScore: 92,
        tags: ["evolution", "adaptation", "genetic", "optimization"],
        lineage: {
          ancestors: ["Gene-v1", "Gene-v2"],
          descendants: ["Gene-v4", "Gene-v5"],
        },
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (isError || !asset) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg text-[var(--color-muted-foreground)]">
          Failed to load asset
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <AssetHeader asset={asset} />
        
        <Tabs defaultValue="description">
          <TabsList>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="lineage">Lineage</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="description">
            <AssetDescription description={asset.description} tags={asset.tags} />
          </TabsContent>
          <TabsContent value="lineage">
            <AssetLineage lineage={asset.lineage} />
          </TabsContent>
          <TabsContent value="reviews">
            <Card>
              <CardContent className="py-8 text-center text-[var(--color-muted-foreground)]">
                No reviews yet
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <div>
        <AssetPurchase assetId={asset.id} price={asset.price} />
      </div>
    </div>
  );
}

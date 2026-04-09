"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

type AssetType = "Gene" | "Capsule" | "Recipe";

interface AssetListingCardProps {
  asset: {
    id: string;
    name: string;
    type: AssetType;
    price: number;
    seller: string;
    gdiScore: number;
  };
}

const typeVariants: Record<AssetType, string> = {
  Gene: "gene",
  Capsule: "capsule",
  Recipe: "recipe",
};

const typeColors: Record<AssetType, string> = {
  Gene: "var(--color-gene-green)",
  Capsule: "var(--color-capsule-blue)",
  Recipe: "var(--color-recipe-amber)",
};

function GDIScoreBadge({ score }: { score: number }) {
  let color = "text-amber-500";
  let bg = "bg-amber-500/10";
  if (score >= 90) {
    color = "text-[var(--color-success)]";
    bg = "bg-[var(--color-success)]/10";
  } else if (score >= 80) {
    color = "text-[var(--color-capsule-blue)]";
    bg = "bg-[var(--color-capsule-blue)]/10";
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold",
        bg,
        color
      )}
    >
      GDI {score}
    </span>
  );
}

export function AssetListingCard({ asset }: AssetListingCardProps) {
  return (
    <Link href={`/browse/${asset.id}`} className="block">
      <Card
        className="h-full cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
        style={{
          transitionProperty: "transform, box-shadow",
          transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-lg font-semibold leading-tight">{asset.name}</span>
            <Badge variant={typeVariants[asset.type] as "gene" | "capsule" | "recipe"}>
              {asset.type}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">
              Seller
            </span>
            <span className="font-medium">{asset.seller}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">Price</span>
            <span className="font-semibold" style={{ color: typeColors[asset.type] }}>
              {asset.price} credits
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">
              GDI Score
            </span>
            <GDIScoreBadge score={asset.gdiScore} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

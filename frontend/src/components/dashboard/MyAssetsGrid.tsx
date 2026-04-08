"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Asset } from "@/lib/api/client";
import { normalizeGDI } from "@/lib/api/normalizers";
import { Download, TrendingUp } from "lucide-react";

interface MyAssetsGridProps {
  assets: Asset[];
  activeFilter: string;
}

const TYPE_VARIANT: Record<string, "gene" | "capsule" | "recipe"> = {
  Gene: "gene",
  Capsule: "capsule",
  Recipe: "recipe",
};

export function MyAssetsGrid({ assets, activeFilter }: MyAssetsGridProps) {
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] py-16 text-center">
        <TrendingUp className="mb-3 h-8 w-8 text-[var(--color-muted-foreground)]" />
        <p className="text-[var(--color-muted-foreground)]">
          No {activeFilter !== "All" ? activeFilter : ""} assets found
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Publish your first asset to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((asset) => {
        const gdi = normalizeGDI(asset.gdi_score);
        return (
          <Card key={asset.asset_id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold">
                  {asset.name}
                </CardTitle>
                <Badge variant={TYPE_VARIANT[asset.type] ?? "default"}>
                  {asset.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {asset.description && (
                <p className="line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
                  {asset.description}
                </p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted-foreground)]">GDI Score</span>
                <span className="font-semibold text-[var(--color-foreground)]">
                  {gdi.overall.toFixed(1)}
                </span>
              </div>
              {asset.downloads !== undefined && (
                <div className="flex items-center gap-1 text-sm text-[var(--color-muted-foreground)]">
                  <Download className="h-3.5 w-3.5" />
                  <span>{asset.downloads.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

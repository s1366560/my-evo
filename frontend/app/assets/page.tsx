"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Boxes, Search, Filter, Plus } from "lucide-react";

type Asset = {
  asset_id: string;
  name: string;
  type: "gene" | "capsule";
  grade: string;
  gdi: number;
  published_at: string;
  publisher: string;
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "gene" | "capsule">("all");

  useEffect(() => {
    async function fetchAssets() {
      try {
        const res = await fetch("/api/v2/assets");
        if (res.ok) {
          const data = await res.json();
          setAssets(data.assets || []);
        }
      } catch (error) {
        console.error("Failed to fetch assets:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAssets();
  }, []);

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch = asset.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || asset.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Boxes className="size-8" />
            Assets
          </h1>
          <p className="text-muted-foreground">Browse and manage Gene & Capsule assets</p>
        </div>
        <Button className="gap-2">
          <Plus className="size-4" />
          Publish Asset
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "gene" ? "default" : "outline"}
            onClick={() => setFilter("gene")}
          >
            Genes
          </Button>
          <Button
            variant={filter === "capsule" ? "default" : "outline"}
            onClick={() => setFilter("capsule")}
          >
            Capsules
          </Button>
        </div>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filteredAssets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No assets found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.map((asset) => (
            <Card key={asset.asset_id} className="hover:border-primary/50 cursor-pointer transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{asset.name}</CardTitle>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    asset.type === "gene" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {asset.type}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Grade:</span>
                    <span className="font-medium">{asset.grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">GDI:</span>
                    <span className="font-medium">{asset.gdi.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Publisher:</span>
                    <span className="font-medium truncate max-w-[120px]">{asset.publisher}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Published:</span>
                    <span className="text-xs">{new Date(asset.published_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

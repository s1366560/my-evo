"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useGDIScoreHistory } from "@/lib/api/hooks";
import { History, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";

function HistoryCard({ assetId }: { assetId: string }) {
  const { data, isLoading, isError } = useGDIScoreHistory(assetId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{assetId}</p>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No history found for this asset.</p>
        </CardContent>
      </Card>
    );
  }

  const scores = data.history;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{assetId}</p>
          <Badge variant="outline">{scores.length} scores</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {scores.map((s, i) => {
          const prev = scores[i + 1];
          const delta = prev ? s.overall - prev.overall : null;
          const date = new Date(s.calculated_at).toLocaleDateString(undefined, {
            month: "short", day: "numeric", year: "numeric",
          });
          return (
            <div key={s.calculated_at} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{date}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums text-[var(--color-foreground)]">
                  {s.overall.toFixed(1)}
                </span>
                {delta !== null && (
                  <span className="flex items-center gap-0.5 text-xs tabular-nums" style={{
                    color: delta > 0 ? "var(--color-gene-green)" : delta < 0 ? "var(--color-destructive)" : "var(--color-muted-foreground)",
                  }}>
                    {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ScoringHistory() {
  const [query, setQuery] = useState("");

  // Demo asset IDs for lookup
  const demoAssets = ["gene-001", "gene-002"];

  const assets = query.trim()
    ? query.split(",").map(a => a.trim()).filter(Boolean)
    : demoAssets;

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-[var(--color-foreground)]">
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter asset IDs (comma-separated)..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty to view demo history for sample assets.
            Enter IDs like: gene-001, gene-002, capsule-003
          </p>
        </CardContent>
      </Card>

      {/* History cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map(id => (
          <HistoryCard key={id} assetId={id} />
        ))}
        {assets.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
            <History className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Enter asset IDs above to view their score history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

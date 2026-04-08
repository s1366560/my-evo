"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, type TrendingSignal } from "@/lib/api/client";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function TrendIcon({ trend }: { trend: TrendingSignal["trend"] }) {
  if (trend === "up")
    return <TrendingUp className="h-3.5 w-3.5 text-[var(--color-gene-green)]" />;
  if (trend === "down")
    return <TrendingDown className="h-3.5 w-3.5 text-[var(--color-destructive)]" />;
  return <Minus className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />;
}

function TrendingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-10 animate-pulse rounded-md bg-[var(--color-border)]/30"
        />
      ))}
    </div>
  );
}

export function TrendingSignals() {
  const { data, isLoading } = useQuery({
    queryKey: ["a2a", "trending"],
    queryFn: () => apiClient.getTrending(),
  });

  if (isLoading) return <TrendingSkeleton />;

  const signals = data?.signals ?? [];

  return (
    <div className="space-y-2">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-foreground)]">
        Trending Signals
      </h2>
      <div className="space-y-1">
        {signals.slice(0, 10).map((signal, index) => (
          <div
            key={signal.signal_id}
            className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-border)]"
          >
            <span className="w-5 text-center text-sm font-medium tabular-nums text-[var(--color-muted-foreground)]">
              {index + 1}
            </span>
            <Badge
              variant="secondary"
              className="font-mono text-xs"
            >
              {signal.name}
            </Badge>
            <span className="ml-auto text-sm tabular-nums text-[var(--color-muted-foreground)]">
              {signal.count.toLocaleString()}
            </span>
            <TrendIcon trend={signal.trend} />
          </div>
        ))}
      </div>
    </div>
  );
}

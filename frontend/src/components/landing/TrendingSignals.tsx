"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api/client";

const SIGNAL_COLORS: Record<string, string> = {
  repair: "bg-amber-100 text-amber-800 border-amber-200",
  optimize: "bg-emerald-100 text-emerald-800 border-emerald-200",
  innovate: "bg-violet-100 text-violet-800 border-violet-200",
  explore: "bg-sky-100 text-sky-800 border-sky-200",
  discover: "bg-rose-100 text-rose-800 border-rose-200",
  rag: "bg-blue-100 text-blue-800 border-blue-200",
  code: "bg-gray-100 text-gray-800 border-gray-200",
  security: "bg-red-100 text-red-800 border-red-200",
  context: "bg-purple-100 text-purple-800 border-purple-200",
  retrieval: "bg-teal-100 text-teal-800 border-teal-200",
  planning: "bg-orange-100 text-orange-800 border-orange-200",
  reasoning: "bg-indigo-100 text-indigo-800 border-indigo-200",
  memory: "bg-pink-100 text-pink-800 border-pink-200",
};

export function TrendingSignals() {
  const { data, isLoading } = useQuery({
    queryKey: ["trending-signals"],
    queryFn: () => apiClient.getTrendingSignals(),
    staleTime: 5 * 60 * 1000,
  });

  const signals = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-8 text-center">
        <TrendingUp className="mx-auto h-8 w-8 text-[var(--color-foreground-soft)]" />
        <p className="mt-3 text-sm text-[var(--color-foreground-soft)]">No trending signals yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {signals.slice(0, 8).map((signal: { signal_type: string; count: number; label?: string }, index: number) => (
        <div
          key={signal.signal_type}
          className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 transition-colors hover:border-[var(--color-gene-green)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-gene-green)_12%,transparent)] text-xs font-semibold text-[var(--color-gene-green)]">
              {index + 1}
            </span>
            <Badge variant="outline" className={SIGNAL_COLORS[signal.signal_type] ?? "bg-gray-100 text-gray-800 border-gray-200"}>
              {signal.label ?? signal.signal_type}
            </Badge>
          </div>
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            {signal.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * MatchHistory — awaiting GET /api/v2/arena/matches endpoint.
 * TODO: wire useQuery(() => apiClient.getArenaMatches()) once backend exposes match history API.
 */
export function MatchHistory() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
      <div className="mb-4 space-y-1">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border border-dashed border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

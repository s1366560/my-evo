"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, ArenaMatch } from "@/lib/api/client";

function MatchRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-md border border-dashed border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

function MatchRow({ match }: { match: ArenaMatch }) {
  const challenger = match.challenger_name ?? match.match_id;
  const defender = match.defender_name ?? "Unknown";
  const isCompleted = match.status === "completed";

  const resultLabel = isCompleted
    ? match.winner_id === match.challenger_id
      ? "Won"
      : "Lost"
    : "Pending";

  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Outcome indicator dot */}
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            resultLabel === "Won"
              ? "bg-[var(--color-success)]"
              : resultLabel === "Lost"
              ? "bg-[var(--color-destructive)]"
              : "bg-[var(--color-muted-foreground)]"
          }`}
          aria-hidden="true"
        />
        <span className="text-sm text-[var(--color-foreground)]">
          {challenger}
          {isCompleted && match.challenger_score !== undefined && (
            <span className="ml-1 font-medium text-[var(--color-success)]">
              {match.challenger_score}
            </span>
          )}
          {" vs "}
          {defender}
          {isCompleted && match.defender_score !== undefined && (
            <span className="ml-1 font-medium text-[var(--color-destructive)]">
              {match.defender_score}
            </span>
          )}
        </span>
      </div>
      <span
        className={`text-xs font-medium ${
          resultLabel === "Won"
            ? "text-[var(--color-success)]"
            : resultLabel === "Lost"
            ? "text-[var(--color-destructive)]"
            : "text-[var(--color-muted-foreground)]"
        }`}
        aria-label={`Match result: ${resultLabel}`}
      >
        {resultLabel}
      </span>
    </div>
  );
}

/**
 * MatchHistory — loads arena match data via GET /api/v2/arena/matches.
 * Gracefully handles the case where the endpoint is not yet implemented.
 */
export function MatchHistory() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["arena", "matches"],
    queryFn: () => apiClient.getArenaMatches(),
    // Don't retry on failure — we want the empty state to show quickly
    retry: false,
  });

  const matches = data?.items ?? [];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-5">
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
          Match History
        </h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Recent arena match outcomes
        </p>
      </div>

      {isLoading && (
        <div
          className="space-y-2"
          aria-busy="true"
          aria-label="Loading match history"
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <MatchRowSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-[var(--color-destructive)]/30 bg-[var(--color-destructive)]/5 p-4 text-center text-sm text-[var(--color-destructive)]">
          Failed to load match history.
        </div>
      )}

      {!isLoading && !isError && matches.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
          No match history available yet.
        </div>
      )}

      {!isLoading && !isError && matches.length > 0 && (
        <div
          className="space-y-2"
          role="list"
          aria-label="Match history list"
        >
          {matches.slice(0, 10).map((match) => (
            <div key={match.match_id} role="listitem">
              <MatchRow match={match} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { RankingTable } from "@/components/arena/RankingTable";
import { MatchHistory } from "@/components/arena/MatchHistory";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArenaPage() {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [tab, setTab] = useState<"current" | "past" | "alltime">("current");

  const {
    data: seasons,
    isLoading: seasonsLoading,
    error: seasonsError,
  } = useQuery({
    queryKey: ["arena", "seasons"],
    queryFn: () => apiClient.getArenaSeasons(),
  });

  const activeSeason = seasons?.find((s) => s.status === "active");

  const tabs = [
    { key: "current", label: "Current Season" },
    { key: "past", label: "Past Seasons" },
    { key: "alltime", label: "All-Time Rankings" },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Arena Leaderboard</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Compete in the EvoMap Arena. Top agents are ranked by Elo score across
          seasons.
        </p>
      </div>

      {/* Season Tab */}
      {seasonsLoading && (
        <Skeleton className="h-10 w-full max-w-md" />
      )}
      {seasonsError && (
        <p className="text-sm text-[var(--color-destructive)]">
          Failed to load seasons.
        </p>
      )}
      {!seasonsLoading && seasons && (
        <div className="flex gap-4 border-b border-[var(--color-border)]">
          {tab === "current" && (
            <select
              className="mb-[-1px] border-b-2 border-[var(--color-gene-green)] bg-transparent pb-3 text-sm font-medium text-[var(--color-gene-green)] outline-none"
              value={selectedSeasonId ?? activeSeason?.season_id ?? ""}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s.season_id} value={s.season_id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-[var(--color-gene-green)] text-[var(--color-gene-green)]"
                  : "border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Ranking Table */}
      {tab === "current" && (
        <RankingTable seasonId={selectedSeasonId ?? activeSeason?.season_id ?? null} />
      )}
      {tab === "past" && (
        <RankingTable seasonId={null} pastSeasons={seasons ?? []} />
      )}
      {tab === "alltime" && (
        <RankingTable seasonId={null} allTime />
      )}

      {/* Match History */}
      <MatchHistory />
    </div>
  );
}

"use client";

import { RankingTable } from "@/components/arena/RankingTable";
import { MatchHistory } from "@/components/arena/MatchHistory";

export default function ArenaPage() {
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
      <div className="flex gap-4 border-b border-[var(--color-border)]">
        <button className="border-b-2 border-[var(--color-gene-green)] pb-3 text-sm font-medium text-[var(--color-gene-green)]">
          Current Season
        </button>
        <button className="pb-3 text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          Past Seasons
        </button>
        <button className="pb-3 text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
          All-Time Rankings
        </button>
      </div>

      {/* Ranking Table */}
      <RankingTable />

      {/* Match History */}
      <MatchHistory />
    </div>
  );
}

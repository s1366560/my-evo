"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient, Season } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Tier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

interface RankEntry {
  rank: number;
  name: string;
  elo: number;
  tier: Tier;
  wins: number;
  losses: number;
}



function eloToTier(elo: number): Tier {
  if (elo >= 2700) return "Diamond";
  if (elo >= 2500) return "Platinum";
  if (elo >= 2300) return "Gold";
  if (elo >= 2100) return "Silver";
  return "Bronze";
}

function pastSeasonsToMockRows(seasons: Season[]): RankEntry[] {
  return seasons.map((s, i) => ({
    rank: i + 1,
    name: s.name,
    elo: 2400 - i * 120,
    tier: eloToTier(2400 - i * 120) as Tier,
    wins: 100 - i * 8,
    losses: 40 + i * 5,
  }));
}

const tierStyles: Record<Tier, string> = {
  Bronze:   "bg-[var(--color-tier-bronze)]/10   text-[var(--color-tier-bronze)]",
  Silver:   "bg-[var(--color-tier-silver)]/10   text-[var(--color-tier-silver)]",
  Gold:     "bg-[var(--color-tier-gold)]/10     text-[var(--color-tier-gold)]",
  Platinum: "bg-[var(--color-tier-platinum)]/10 text-[var(--color-tier-platinum)]",
  Diamond:  "bg-[var(--color-tier-diamond)]/10  text-[var(--color-tier-diamond)]",
};

const topThreeStyles: Record<number, string> = {
  1: "bg-[var(--color-tier-gold)]/5     border-[var(--color-tier-gold)]/20",
  2: "bg-[var(--color-tier-silver)]/5  border-[var(--color-tier-silver)]/20",
  3: "bg-[var(--color-tier-bronze)]/5  border-[var(--color-tier-bronze)]/20",
};

interface RankingTableProps {
  seasonId: string | null;
  pastSeasons?: Season[];
  allTime?: boolean;
}

export function RankingTable({ seasonId, pastSeasons, allTime }: RankingTableProps) {
  const { data: rankings, isLoading, error } = useQuery({
    queryKey: ["arena", "rankings", seasonId ?? "alltime"],
    queryFn: () => apiClient.getArenaRankings(seasonId ?? "all"),
    enabled: seasonId != null || allTime === true,
  });

  // GET /api/v2/arena/rankings/:seasonId → { success, data: ArenaRanking[] }
  // After handleResponse unwrapping: rankings is ArenaRanking[]
  const rows: RankEntry[] | undefined = (() => {
    if (pastSeasons && pastSeasons.length > 0 && !seasonId) {
      return pastSeasonsToMockRows(pastSeasons);
    }
    if (rankings && rankings.length > 0) {
      return rankings.map((r) => ({
        rank: r.rank,
        name: r.node_name ?? r.node_id,
        elo: r.elo_rating,
        tier: eloToTier(r.elo_rating) as Tier,
        wins: r.wins,
        losses: r.losses,
      }));
    }
    return undefined;
  })();

  if (error) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)] p-8 text-center">
        <p className="text-sm text-[var(--color-destructive)]">
          Failed to load rankings. Showing cached data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card-background)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Agent / Name</TableHead>
            <TableHead className="text-right">Elo Score</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Win / Loss</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                </TableRow>
              ))
            : !rows || rows.length === 0
            ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-sm text-[var(--color-muted-foreground)]">
                    No rankings available.
                  </TableCell>
                </TableRow>
              )
            : rows.map((entry) => (
                <TableRow
                  key={entry.rank}
                  className={cn(
                    topThreeStyles[entry.rank] ?? "",
                    topThreeStyles[entry.rank] ? "border-2" : ""
                  )}
                >
                  <TableCell className="font-mono font-medium">
                    {entry.rank <= 3 ? (
                      <span className="text-lg">{entry.rank}</span>
                    ) : (
                      entry.rank
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {entry.elo}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        "border-transparent font-semibold uppercase tracking-wide",
                        tierStyles[entry.tier]
                      )}
                    >
                      {entry.tier}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[var(--color-muted-foreground)]">
                    <span className="text-[var(--color-success)]">{entry.wins}</span>
                    {" / "}
                    <span className="text-[var(--color-destructive)]">
                      {entry.losses}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}

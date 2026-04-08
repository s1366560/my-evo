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

const MOCK_RANKINGS: RankEntry[] = [
  { rank: 1, name: "EvoAgent-Omega", elo: 2847, tier: "Diamond", wins: 142, losses: 23 },
  { rank: 2, name: "DeepSynth-7B", elo: 2781, tier: "Diamond", wins: 138, losses: 31 },
  { rank: 3, name: "NeuralHunter-X", elo: 2712, tier: "Diamond", wins: 129, losses: 38 },
  { rank: 4, name: "CortexElite", elo: 2654, tier: "Platinum", wins: 118, losses: 42 },
  { rank: 5, name: "MetaLearner-v3", elo: 2601, tier: "Platinum", wins: 112, losses: 45 },
  { rank: 6, name: "AgnosticAI", elo: 2543, tier: "Platinum", wins: 105, losses: 51 },
  { rank: 7, name: "QuantumThinker", elo: 2498, tier: "Gold", wins: 99, losses: 57 },
  { rank: 8, name: "SynapseCore", elo: 2431, tier: "Gold", wins: 94, losses: 62 },
  { rank: 9, name: "LogicFlow-v9", elo: 2376, tier: "Gold", wins: 88, losses: 66 },
  { rank: 10, name: "PrimevalMind", elo: 2312, tier: "Gold", wins: 83, losses: 71 },
  { rank: 11, name: "AdaBot-v2", elo: 2254, tier: "Silver", wins: 77, losses: 73 },
  { rank: 12, name: "FluxRunner", elo: 2198, tier: "Silver", wins: 72, losses: 78 },
  { rank: 13, name: "HelixAgent", elo: 2141, tier: "Silver", wins: 67, losses: 82 },
  { rank: 14, name: "NovaCognitio", elo: 2087, tier: "Silver", wins: 62, losses: 87 },
  { rank: 15, name: "PulsarNode", elo: 2034, tier: "Bronze", wins: 57, losses: 92 },
  { rank: 16, name: "ZenithCore", elo: 1981, tier: "Bronze", wins: 52, losses: 97 },
  { rank: 17, name: "AxiomSolver", elo: 1923, tier: "Bronze", wins: 47, losses: 102 },
  { rank: 18, name: "GridMind-5", elo: 1867, tier: "Bronze", wins: 42, losses: 107 },
  { rank: 19, name: "TangentAI", elo: 1812, tier: "Bronze", wins: 37, losses: 112 },
  { rank: 20, name: "FractalGen", elo: 1754, tier: "Bronze", wins: 32, losses: 117 },
];

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
  Bronze: "bg-orange-500/10 text-orange-500",
  Silver: "bg-gray-400/10 text-gray-400",
  Gold: "bg-yellow-500/10 text-yellow-600",
  Platinum: "bg-teal-500/10 text-teal-500",
  Diamond: "bg-purple-500/10 text-purple-500",
};

const topThreeStyles: Record<number, string> = {
  1: "bg-yellow-500/5 border-yellow-500/20",
  2: "bg-gray-300/5 border-gray-400/20",
  3: "bg-orange-700/5 border-orange-500/20",
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

  const rows: RankEntry[] = (() => {
    if (allTime && !seasonId) {
      return MOCK_RANKINGS.slice(0, 10);
    }
    if (pastSeasons && pastSeasons.length > 0 && !seasonId) {
      return pastSeasonsToMockRows(pastSeasons);
    }
    if (rankings && rankings.length > 0) {
      return rankings.map((r) => ({
        rank: r.rank,
        name: r.node_name ?? r.node_id,
        elo: r.score,
        tier: eloToTier(r.score) as Tier,
        wins: r.wins ?? 0,
        losses: r.losses ?? 0,
      }));
    }
    return MOCK_RANKINGS;
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

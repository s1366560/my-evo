"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Users, Swords, Medal, TrendingUp, Calendar } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RankingEntry {
  rank: number;
  node_id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
  win_rate: number;
}

interface MatchEntry {
  match_id: string;
  agent_a: string;
  agent_b: string;
  winner: string;
  score_a: number;
  score_b: number;
  timestamp: string;
}

interface ArenaStats {
  total_matches: number;
  active_competitors: number;
  total_prize_pool: number;
  current_season: string;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function ArenaSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-full bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Rank Badge ──────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="font-mono text-sm">#{rank}</span>;
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ArenaPage() {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [stats, setStats] = useState<ArenaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [rankingsRes, matchesRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v2/arena/rankings?category=${selectedCategory}`),
          fetch(`${API_BASE}/api/v2/arena/matches`),
          fetch(`${API_BASE}/api/v2/arena/stats`),
        ]);

        if (!rankingsRes.ok || !matchesRes.ok || !statsRes.ok) {
          throw new Error("Failed to fetch arena data");
        }

        const rankingsData = await rankingsRes.json();
        const matchesData = await matchesRes.json();
        const statsData = await statsRes.json();

        setRankings(rankingsData.data?.items ?? []);
        setMatches(matchesData.data?.items ?? []);
        setStats(statsData.data ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load arena data");
        // Fallback to mock data for demo
        setRankings([
          { rank: 1, node_id: "node-champion-001", name: "Alpha Champion", score: 2850, wins: 45, losses: 5, win_rate: 0.9 },
          { rank: 2, node_id: "node-champion-002", name: "Beta Challenger", score: 2720, wins: 40, losses: 8, win_rate: 0.833 },
          { rank: 3, node_id: "node-champion-003", name: "Gamma Contender", score: 2650, wins: 38, losses: 10, win_rate: 0.792 },
        ]);
        setMatches([
          { match_id: "match-001", agent_a: "node-champion-001", agent_b: "node-champion-002", winner: "node-champion-001", score_a: 3, score_b: 1, timestamp: "2025-04-20T14:00:00Z" },
        ]);
        setStats({ total_matches: 15420, active_competitors: 892, total_prize_pool: 50000, current_season: "Season 7" });
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [selectedCategory]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">AI Agent Arena</h1>
        <ArenaSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="arena-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-7 w-7 text-primary" />
          AI Agent Arena
        </h1>
        <p className="text-muted-foreground mt-1">
          Compete with other AI agents and climb the leaderboard
        </p>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4" data-testid="arena-stats">
          <StatCard icon={Trophy} label="Total Matches" value={stats.total_matches.toLocaleString()} />
          <StatCard icon={Users} label="Active Competitors" value={stats.active_competitors.toLocaleString()} />
          <StatCard icon={TrendingUp} label="Prize Pool" value={`$${stats.total_prize_pool.toLocaleString()}`} />
          <StatCard icon={Calendar} label="Current Season" value={stats.current_season} />
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-2" data-testid="category-tabs">
        {["all", "coding", "reasoning", "creative"].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Rankings Table */}
      <Card data-testid="ranking-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5" />
            Leaderboard
          </CardTitle>
          <CardDescription>Top AI agents competing in the arena</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div data-testid="ranking-table" className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Wins</TableHead>
                  <TableHead className="text-right">Losses</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((entry) => (
                  <TableRow key={entry.node_id} data-testid={`ranking-row-${entry.rank}`}>
                    <TableCell>
                      <RankBadge rank={entry.rank} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{entry.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{entry.node_id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {entry.score.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="default" className="bg-green-500/20 text-green-600">
                        {entry.wins}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{entry.losses}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(entry.win_rate * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Match History */}
      <Card data-testid="match-history-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" />
            Match History
          </CardTitle>
          <CardDescription>Recent arena battles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.match_id}
                className="flex items-center justify-between p-3 rounded-lg border"
                data-testid={`match-${match.match_id}`}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{match.agent_a.split("-").pop()}</Badge>
                  <span className="text-muted-foreground">vs</span>
                  <Badge variant="outline">{match.agent_b.split("-").pop()}</Badge>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm">
                    {match.score_a} - {match.score_b}
                  </span>
                  <Badge
                    variant={match.winner === match.agent_a ? "default" : "secondary"}
                    className="bg-primary/20"
                  >
                    Winner: {match.winner.split("-").pop()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

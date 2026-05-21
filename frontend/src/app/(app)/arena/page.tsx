"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/lib/api/client";
import type { Season, ArenaMatch } from "@/lib/api/client";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

interface ArenaStats {
  total_matches: number;
  active_competitors: number;
  total_prize_pool: number;
  current_season: string;
}

interface RankingItem {
  rank: number;
  node_id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
  win_rate: number;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RankingsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export default function ArenaPage() {
  const searchParams = useSearchParams();
  const page = searchParams.get("page") || "1";

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [matches, setMatches] = useState<ArenaMatch[]>([]);
  const [stats, setStats] = useState<ArenaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSeasons() {
      try {
        const res = await apiClient.get<{ success: boolean; data: { seasons: Season[] } }>(
          "/api/v2/arena/seasons"
        );
        const seasonList = res.data?.seasons || [];
        setSeasons(seasonList);
        if (seasonList.length > 0) {
          const active = seasonList.find((s: Season) => s.status === "active") || seasonList[0];
          setSelectedSeason(active.season_id);
        }
      } catch {
        // no seasons yet — use default
        setSelectedSeason("default");
      }
    }
    loadSeasons();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!selectedSeason) return;
      setLoading(true);
      setError(null);
      try {
        const [rankRes, matchRes, statsRes] = await Promise.allSettled([
          apiClient.get<{ success: boolean; data: { items: RankingItem[] } }>(
            `/api/v2/arena/rankings/${selectedSeason}`
          ),
          apiClient.get<{ success: boolean; data: { items: ArenaMatch[] } }>(
            "/api/v2/arena/matches"
          ),
          apiClient.get<{ success: boolean; data: ArenaStats }>(
            "/api/v2/arena/stats"
          ),
        ]);

        if (rankRes.status === "fulfilled") {
          setRankings(rankRes.value.data?.items || []);
        }
        if (matchRes.status === "fulfilled") {
          setMatches(matchRes.value.data?.items || []);
        }
        if (statsRes.status === "fulfilled") {
          setStats(statsRes.value.data || null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load arena data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedSeason]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)]">Arena</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            AI agent competition rankings and match history
          </p>
        </div>
        {stats?.current_season && (
          <Badge variant="outline" className="text-sm">
            {stats.current_season}
          </Badge>
        )}
      </div>

      {/* Stats */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Matches
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {fmt(stats.total_matches)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active Competitors
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {fmt(stats.active_competitors)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Prize Pool
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums">
                {fmt(stats.total_prize_pool)} credits
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Current Season
              </p>
              <p className="text-2xl font-bold mt-1">{stats.current_season}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Season selector */}
      {seasons.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {seasons.map((s) => (
            <Badge
              key={s.season_id}
              variant={s.season_id === selectedSeason ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedSeason(s.season_id)}
            >
              {s.name} ({s.status})
            </Badge>
          ))}
        </div>
      )}

      {/* Tabs: Rankings & Match History */}
      <Tabs defaultValue="rankings" className="w-full">
        <TabsList>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="matches">Match History</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <RankingsSkeleton />
              ) : error && rankings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{error}</p>
                  <p className="text-sm mt-2">No ranking data available for this season.</p>
                </div>
              ) : rankings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No rankings yet. Matches will generate rankings.</p>
                </div>
              ) : (
                <div className="space-y-2" data-testid="ranking-table">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Rank</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Agent</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Score</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">W</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">L</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">Win%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.map((item) => (
                        <tr key={item.node_id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              item.rank === 1 ? "bg-yellow-500/20 text-yellow-500" :
                              item.rank === 2 ? "bg-gray-400/20 text-gray-400" :
                              item.rank === 3 ? "bg-orange-400/20 text-orange-400" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {item.rank}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium">{item.name || item.node_id}</div>
                            <div className="text-xs text-muted-foreground">{item.node_id}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold tabular-nums">{item.score}</td>
                          <td className="py-3 px-3 text-right text-green-600 tabular-nums">{item.wins}</td>
                          <td className="py-3 px-3 text-right text-red-500 tabular-nums">{item.losses}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{(item.win_rate * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Matches</CardTitle>
            </CardHeader>
            <CardContent>
              {loading && matches.length === 0 ? (
                <RankingsSkeleton />
              ) : matches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No matches recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="match-history">
                  {matches.map((match) => (
                    <div
                      key={match.match_id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 bg-muted/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium truncate">
                            {match.challenger_name || match.challenger_id || "Unknown"}
                          </span>
                          <span className="text-muted-foreground text-xs">vs</span>
                          <span className="font-medium truncate">
                            {match.defender_name || match.defender_id || "Unknown"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(match.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold tabular-nums">
                          {match.challenger_score ?? 0} - {match.defender_score ?? 0}
                        </div>
                        {match.winner_id && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              match.winner_id === match.challenger_id
                                ? "border-green-500/50 text-green-600"
                                : "border-blue-500/50 text-blue-600"
                            }`}
                          >
                            {match.winner_id === match.challenger_id ? "Challenger" : "Defender"} wins
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Pagination info */}
      {rankings.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page} — {rankings.length} competitors</span>
        </div>
      )}
    </div>
  );
}

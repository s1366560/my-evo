/**
 * Arena Module Service
 * Provides arena rankings, match history, and stats
 */

import { PrismaClient } from '@prisma/client';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

export interface ArenaState {
  initialized: boolean;
  season: string;
}

export function createArenaState(): ArenaState {
  return { initialized: true, season: 'default' };
}

export interface RankingItem {
  rank: number;
  node_id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface MatchItem {
  match_id: string;
  agent_a: string;
  agent_b: string;
  winner: string | null;
  score_a: number;
  score_b: number;
  timestamp: string;
}

export interface ArenaStats {
  total_matches: number;
  active_competitors: number;
  total_prize_pool: number;
  current_season: string;
}

export async function getSeasons() {
  const seasons = await prisma.arenaSeason.findMany({
    orderBy: { start_date: 'desc' },
    take: 20,
  });
  return seasons.map((s) => ({
    season_id: s.season_id,
    name: s.name,
    status: s.status,
    start_date: s.start_date.toISOString(),
    end_date: s.end_date.toISOString(),
  }));
}

export async function getRankings(seasonId: string) {
  const season = await prisma.arenaSeason.findUnique({
    where: { season_id: seasonId },
  });
  if (!season) return null;
  const rankings = (season.rankings as any[]) || [];
  const items: RankingItem[] = rankings
    .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
    .map((r: any, i: number) => ({
      rank: i + 1,
      node_id: r.node_id || '',
      name: r.name || r.node_id || '',
      score: r.score || 0,
      wins: r.wins || 0,
      losses: r.losses || 0,
      win_rate: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
    }));
  return {
    items,
    meta: { total: items.length, page: 1, limit: 20 },
  };
}

export async function getMatches(seasonId?: string, limit = 20) {
  const where: any = {};
  if (seasonId) where.season_id = seasonId;
  const matches = await prisma.arenaMatch.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
  });
  return {
    items: matches.map((m) => ({
      match_id: m.match_id,
      agent_a: m.challenger,
      agent_b: m.defender,
      winner: m.winner_id,
      score_a: ((m.scores as any) || {}).challenger ?? 0,
      score_b: ((m.scores as any) || {}).defender ?? 0,
      timestamp: m.created_at.toISOString(),
    })),
  };
}

export async function getStats(): Promise<ArenaStats> {
  const totalMatches = await prisma.arenaMatch.count();
  const activeCompetitors = await prisma.arenaMatch.findMany({
    select: { challenger: true, defender: true },
    take: 1000,
  });
  const uniqueCompetitors = new Set<string>();
  activeCompetitors.forEach((m) => {
    uniqueCompetitors.add(m.challenger);
    uniqueCompetitors.add(m.defender);
  });
  const currentSeason = await prisma.arenaSeason.findFirst({
    where: { status: 'active' },
    orderBy: { start_date: 'desc' },
  });
  return {
    total_matches: totalMatches,
    active_competitors: uniqueCompetitors.size,
    total_prize_pool: 0,
    current_season: currentSeason?.name || 'No active season',
  };
}

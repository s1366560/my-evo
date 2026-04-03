import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type { ArenaRanking, ArenaSeasonDetail, ArenaMatchDetail } from './types';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

const DEFAULT_ELO = 1000;
const K_FACTOR = 32;

function calculateElo(
  ratingA: number,
  ratingB: number,
  scoreA: number,
): number {
  const expectedA =
    1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const newRating = ratingA + K_FACTOR * (scoreA - expectedA);
  return Math.round(newRating);
}

export async function createSeason(
  name: string,
  startDate: string,
  endDate: string,
): Promise<ArenaSeasonDetail> {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Season name is required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new ValidationError('End date must be after start date');
  }

  const seasonId = crypto.randomUUID();

  const season = await prisma.arenaSeason.create({
    data: {
      season_id: seasonId,
      name,
      status: 'upcoming',
      start_date: start,
      end_date: end,
      rankings: [],
    },
  });

  return {
    season_id: season.season_id,
    name: season.name,
    status: season.status,
    start_date: season.start_date.toISOString(),
    end_date: season.end_date.toISOString(),
    total_participants: 0,
    total_matches: 0,
    created_at: season.created_at.toISOString(),
  };
}

export async function challenge(
  challengerId: string,
  defenderId: string,
  seasonId: string,
): Promise<ArenaMatchDetail> {
  if (challengerId === defenderId) {
    throw new ValidationError('Cannot challenge yourself');
  }

  const season = await prisma.arenaSeason.findUnique({
    where: { season_id: seasonId },
  });

  if (!season) {
    throw new NotFoundError('Season', seasonId);
  }

  if (season.status !== 'active') {
    throw new ValidationError('Season is not active');
  }

  const matchId = crypto.randomUUID();

  const match = await prisma.arenaMatch.create({
    data: {
      match_id: matchId,
      season_id: seasonId,
      challenger: challengerId,
      defender: defenderId,
      status: 'pending',
      scores: {},
    },
  });

  return {
    match_id: match.match_id,
    season_id: match.season_id,
    challenger: match.challenger,
    defender: match.defender,
    winner_id: match.winner_id,
    status: match.status,
    scores: match.scores as Record<string, number>,
    created_at: match.created_at.toISOString(),
  };
}

export async function submitMatch(
  matchId: string,
  winnerId: string,
  scores: Record<string, number>,
): Promise<ArenaMatchDetail> {
  const match = await prisma.arenaMatch.findUnique({
    where: { match_id: matchId },
  });

  if (!match) {
    throw new NotFoundError('Match', matchId);
  }

  if (match.status !== 'pending') {
    throw new ValidationError('Match is not pending');
  }

  if (winnerId !== match.challenger && winnerId !== match.defender) {
    throw new ValidationError('Winner must be a match participant');
  }

  const rankings = (await prisma.arenaSeason.findUnique({
    where: { season_id: match.season_id },
    select: { rankings: true },
  }))?.rankings as Array<{ node_id: string; elo: number }> ?? [];

  const challengerRanking = rankings.find(
    (r) => r.node_id === match.challenger,
  );
  const defenderRanking = rankings.find(
    (r) => r.node_id === match.defender,
  );

  const challengerElo = challengerRanking?.elo ?? DEFAULT_ELO;
  const defenderElo = defenderRanking?.elo ?? DEFAULT_ELO;

  const challengerScore = winnerId === match.challenger ? 1 : 0;
  const newChallengerElo = calculateElo(
    challengerElo,
    defenderElo,
    challengerScore,
  );
  const newDefenderElo = calculateElo(
    defenderElo,
    challengerElo,
    1 - challengerScore,
  );

  const updatedRankings = [...rankings];
  const cIdx = updatedRankings.findIndex(
    (r) => r.node_id === match.challenger,
  );
  if (cIdx >= 0) {
    const existing = updatedRankings[cIdx]!;
    updatedRankings[cIdx] = {
      ...existing,
      elo: newChallengerElo,
    };
  } else {
    updatedRankings.push({
      node_id: match.challenger,
      elo: newChallengerElo,
    });
  }

  const dIdx = updatedRankings.findIndex(
    (r) => r.node_id === match.defender,
  );
  if (dIdx >= 0) {
    const existing = updatedRankings[dIdx]!;
    updatedRankings[dIdx] = {
      ...existing,
      elo: newDefenderElo,
    };
  } else {
    updatedRankings.push({
      node_id: match.defender,
      elo: newDefenderElo,
    });
  }

  await prisma.arenaSeason.update({
    where: { season_id: match.season_id },
    data: { rankings: updatedRankings },
  });

  const updated = await prisma.arenaMatch.update({
    where: { match_id: matchId },
    data: {
      winner_id: winnerId,
      status: 'completed',
      scores,
      completed_at: new Date(),
    },
  });

  return {
    match_id: updated.match_id,
    season_id: updated.season_id,
    challenger: updated.challenger,
    defender: updated.defender,
    winner_id: updated.winner_id,
    status: updated.status,
    scores: updated.scores as Record<string, number>,
    created_at: updated.created_at.toISOString(),
  };
}

export async function getRankings(
  seasonId: string,
): Promise<ArenaRanking[]> {
  const season = await prisma.arenaSeason.findUnique({
    where: { season_id: seasonId },
  });

  if (!season) {
    throw new NotFoundError('Season', seasonId);
  }

  const rankingsData = (season.rankings as Array<{
    node_id: string;
    elo: number;
  }>) ?? [];

  const matches = await prisma.arenaMatch.findMany({
    where: { season_id: seasonId, status: 'completed' },
  });

  const statsByNode: Record<
    string,
    { wins: number; losses: number; matches: number }
  > = {};

  for (const m of matches) {
    const participants = [m.challenger, m.defender];
    for (const p of participants) {
      if (!statsByNode[p]) {
        statsByNode[p] = { wins: 0, losses: 0, matches: 0 };
      }
      statsByNode[p].matches += 1;
      if (m.winner_id === p) {
        statsByNode[p].wins += 1;
      } else {
        statsByNode[p].losses += 1;
      }
    }
  }

  const sorted = [...rankingsData].sort((a, b) => b.elo - a.elo);

  return sorted.map((r, idx) => ({
    node_id: r.node_id,
    elo_rating: r.elo,
    wins: statsByNode[r.node_id]?.wins ?? 0,
    losses: statsByNode[r.node_id]?.losses ?? 0,
    draws: 0,
    matches_played: statsByNode[r.node_id]?.matches ?? 0,
    rank: idx + 1,
  }));
}

export async function getSeason(
  seasonId: string,
): Promise<ArenaSeasonDetail> {
  const season = await prisma.arenaSeason.findUnique({
    where: { season_id: seasonId },
  });

  if (!season) {
    throw new NotFoundError('Season', seasonId);
  }

  const matchCount = await prisma.arenaMatch.count({
    where: { season_id: seasonId },
  });

  const rankingsData =
    (season.rankings as Array<{ node_id: string }>) ?? [];

  return {
    season_id: season.season_id,
    name: season.name,
    status: season.status,
    start_date: season.start_date.toISOString(),
    end_date: season.end_date.toISOString(),
    total_participants: rankingsData.length,
    total_matches: matchCount,
    created_at: season.created_at.toISOString(),
  };
}

export async function listSeasons(
  status?: string,
  limit = 20,
): Promise<ArenaSeasonDetail[]> {
  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const seasons = await prisma.arenaSeason.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return seasons.map((s) => ({
    season_id: s.season_id,
    name: s.name,
    status: s.status,
    start_date: s.start_date.toISOString(),
    end_date: s.end_date.toISOString(),
    total_participants:
      ((s.rankings as unknown as Array<unknown>) ?? []).length,
    total_matches: 0,
    created_at: s.created_at.toISOString(),
  }));
}

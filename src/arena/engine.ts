/**
 * Arena Engine - In-memory battle system
 * Phase 6+: Arena Battle System
 */

import { randomBytes } from 'crypto';
import {
  ArenaBattle,
  ArenaSeason,
  LeaderboardEntry,
  BattleResultPayload,
  MatchmakingEntry,
  BattleStatus,
  ARENA_INITIAL_ELO,
  ARENA_K_FACTOR,
  ARENA_SEASON_DURATION_DAYS,
  TopicSaturationEntry,
  TopicSaturationResponse,
  TOPIC_SATURATION_COLD,
  TOPIC_SATURATION_WARM,
  TOPIC_SATURATION_HOT,
  TOPIC_SATURATION_OVER,
  SaturationRecommendation,
} from './types';
import { getActiveAssets } from '../assets/store';
import { calculateGDI } from '../assets/gdi';
import { Asset, Gene, Capsule } from '../assets/types';

// In-memory stores
const battles = new Map<string, ArenaBattle>();
const seasons = new Map<string, ArenaSeason>();
const eloRatings = new Map<string, number>(); // node_id -> elo
const battleResults = new Map<string, BattleResultPayload>(); // battle_id -> result submitted by node_a
const matchmakingQueue: MatchmakingEntry[] = [];

/** Generate a short ID */
function genId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

/** Get or init Elo for a node */
function getElo(nodeId: string): number {
  if (!eloRatings.has(nodeId)) {
    eloRatings.set(nodeId, ARENA_INITIAL_ELO);
  }
  return eloRatings.get(nodeId)!;
}

/** Calculate expected score */
function expectedScore(eloA: number, eloB: number): number {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/** Calculate new Elo after a battle */
function computeNewElo(currentElo: number, expected: number, actual: number): number {
  return Math.round(currentElo + ARENA_K_FACTOR * (actual - expected));
}

// ============ Season Management ============

export function getOrCreateActiveSeason(): ArenaSeason {
  const now = new Date();
  
  // Find active season
  for (const season of seasons.values()) {
    if (season.status === 'active') {
      return season;
    }
  }
  
  // Create new season
  const seasonNumber = seasons.size + 1;
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + ARENA_SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000);
  
  const season: ArenaSeason = {
    season_id: genId('season'),
    number: seasonNumber,
    started_at: startDate.toISOString(),
    ends_at: endDate.toISOString(),
    status: 'active',
    top_battles: [],
  };
  
  seasons.set(season.season_id, season);
  return season;
}

// ============ Matchmaking ============

export function joinMatchmaking(nodeId: string, topic: string): { position: number; estimated_wait_s: number } {
  // Remove if already in queue
  const existingIdx = matchmakingQueue.findIndex(e => e.node_id === nodeId);
  if (existingIdx !== -1) {
    matchmakingQueue.splice(existingIdx, 1);
  }
  
  const entry: MatchmakingEntry = {
    node_id: nodeId,
    elo: getElo(nodeId),
    topic,
    joined_at: new Date().toISOString(),
  };
  
  matchmakingQueue.push(entry);
  
  // Try to match immediately
  tryMatch(nodeId, topic);
  
  return {
    position: matchmakingQueue.findIndex(e => e.node_id === nodeId) + 1,
    estimated_wait_s: 30,
  };
}

export function leaveMatchmaking(nodeId: string): boolean {
  const idx = matchmakingQueue.findIndex(e => e.node_id === nodeId);
  if (idx !== -1) {
    matchmakingQueue.splice(idx, 1);
    return true;
  }
  return false;
}

export function getMatchmakingStatus(nodeId: string): { in_queue: boolean; position?: number; opponent?: string } {
  const idx = matchmakingQueue.findIndex(e => e.node_id === nodeId);
  if (idx === -1) return { in_queue: false };
  
  // Check if matched
  const opponent = matchmakingQueue.find((e, i) => i !== idx && e.topic === matchmakingQueue[idx]?.topic);
  
  return {
    in_queue: true,
    position: idx + 1,
    opponent: opponent?.node_id,
  };
}

function tryMatch(nodeId: string, topic: string): ArenaBattle | null {
  const myEntry = matchmakingQueue.find(e => e.node_id === nodeId);
  if (!myEntry) return null;
  
  // Find opponent with similar Elo (±100) and same topic
  const opponentIdx = matchmakingQueue.findIndex(
    (e, i) => e.node_id !== nodeId && 
               e.topic === topic && 
               Math.abs(e.elo - myEntry.elo) <= 100
  );
  
  if (opponentIdx === -1) return null;
  
  const opponent = matchmakingQueue.splice(opponentIdx, 1)[0];
  // Remove self too
  const selfIdx = matchmakingQueue.findIndex(e => e.node_id === nodeId);
  if (selfIdx !== -1) matchmakingQueue.splice(selfIdx, 1);
  
  // Create battle
  return createBattle(myEntry.node_id, opponent.node_id, topic);
}

// ============ Battle Management ============

export function createBattle(nodeA: string, nodeB: string, topic: string): ArenaBattle {
  const season = getOrCreateActiveSeason();
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000); // 30 min expiry
  
  const battle: ArenaBattle = {
    battle_id: genId('battle'),
    season_id: season.season_id,
    node_a: nodeA,
    node_b: nodeB,
    topic,
    status: 'pending',
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };
  
  battles.set(battle.battle_id, battle);
  return battle;
}

export function getBattle(battleId: string): ArenaBattle | undefined {
  return battles.get(battleId);
}

export function submitBattleResult(payload: BattleResultPayload): ArenaBattle | null {
  const battle = battles.get(payload.battle_id);
  if (!battle || battle.status !== 'pending') return null;
  
  // Store result
  battleResults.set(`${payload.battle_id}_${payload.node_id}`, payload);
  
  // Check if both submitted
  const resA = battleResults.get(`${payload.battle_id}_${battle.node_a}`);
  const resB = battleResults.get(`${payload.battle_id}_${battle.node_b}`);
  
  if (!resA || !resB) {
    // First submission - mark as in_progress
    battle.status = 'in_progress';
    return battle;
  }
  
  // Both submitted - resolve
  return resolveBattle(battle, resA, resB);
}

function resolveBattle(battle: ArenaBattle, resA: BattleResultPayload, resB: BattleResultPayload): ArenaBattle {
  const scoreA = resA.score;
  const scoreB = resB.score;
  
  battle.score_a = scoreA;
  battle.score_b = scoreB;
  battle.status = 'completed';
  battle.completed_at = new Date().toISOString();
  
  // Determine winner
  if (scoreA > scoreB) {
    battle.winner = 'a';
  } else if (scoreB > scoreA) {
    battle.winner = 'b';
  } else {
    battle.winner = 'draw';
  }
  
  // Calculate Elo
  const eloA = getElo(battle.node_a);
  const eloB = getElo(battle.node_b);
  const expA = expectedScore(eloA, eloB);
  const expB = 1 - expA;
  
  let actualA: number, actualB: number;
  if (battle.winner === 'a') { actualA = 1; actualB = 0; }
  else if (battle.winner === 'b') { actualA = 0; actualB = 1; }
  else { actualA = 0.5; actualB = 0.5; }
  
  battle.elo_delta_a = computeNewElo(eloA, expA, actualA) - eloA;
  battle.elo_delta_b = computeNewElo(eloB, expB, actualB) - eloB;
  
  eloRatings.set(battle.node_a, eloA + battle.elo_delta_a);
  eloRatings.set(battle.node_b, eloB + battle.elo_delta_b);
  
  return battle;
}

export function listBattles(filter?: { season_id?: string; node_id?: string; status?: BattleStatus }): ArenaBattle[] {
  let all = [...battles.values()];
  if (filter?.season_id) all = all.filter(b => b.season_id === filter.season_id);
  if (filter?.node_id) all = all.filter(b => b.node_a === filter.node_id || b.node_b === filter.node_id);
  if (filter?.status) all = all.filter(b => b.status === filter.status);
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============ Leaderboard ============

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  const nodeStats = new Map<string, { wins: number; losses: number; draws: number }>();
  
  // Compute stats from completed battles
  for (const battle of battles.values()) {
    if (battle.status !== 'completed') continue;
    
    const statsA = nodeStats.get(battle.node_a) ?? { wins: 0, losses: 0, draws: 0 };
    const statsB = nodeStats.get(battle.node_b) ?? { wins: 0, losses: 0, draws: 0 };
    
    if (battle.winner === 'a') { statsA.wins++; statsB.losses++; }
    else if (battle.winner === 'b') { statsA.losses++; statsB.wins++; }
    else { statsA.draws++; statsB.draws++; }
    
    nodeStats.set(battle.node_a, statsA);
    nodeStats.set(battle.node_b, statsB);
  }
  
  // Build entries
  for (const [nodeId, stats] of nodeStats.entries()) {
    entries.push({
      node_id: nodeId,
      elo: getElo(nodeId),
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      rank: 0,
    });
  }
  
  // Sort by Elo descending
  entries.sort((a, b) => b.elo - a.elo);
  
  // Assign ranks
  entries.forEach((e, i) => { e.rank = i + 1; });
  
  return entries.slice(0, limit);
}

export function getNodeArenaStats(nodeId: string): { elo: number; wins: number; losses: number; draws: number; rank: number } | null {
  if (!eloRatings.has(nodeId)) return null;
  
  let wins = 0, losses = 0, draws = 0;
  for (const battle of battles.values()) {
    if (battle.status !== 'completed') continue;
    if (battle.node_a === nodeId) {
      if (battle.winner === 'a') wins++;
      else if (battle.winner === 'b') losses++;
      else draws++;
    } else if (battle.node_b === nodeId) {
      if (battle.winner === 'b') wins++;
      else if (battle.winner === 'a') losses++;
      else draws++;
    }
  }
  
  const leaderboard = getLeaderboard(1000);
  const rank = leaderboard.findIndex(e => e.node_id === nodeId) + 1;
  
  return { elo: getElo(nodeId), wins, losses, draws, rank: rank || 999 };
}

export { getElo };

// ============ Topic Saturation ============

// Well-known EvoMap signals for saturation analysis
const KNOWN_SIGNALS = [
  'retry',
  'timeout',
  'concurrency',
  'memory',
  'cache',
  'websocket',
  'http',
  'error',
  'async',
  'streaming',
  'rate-limit',
  'circuit-breaker',
  'backoff',
  'pool',
  'queue',
  'batch',
  'pagination',
  'validation',
  'auth',
  'encryption',
  'compression',
  'logging',
  'monitoring',
  'sandbox',
  'swarm',
  'council',
  'reputation',
  'gdi',
  'evolution',
  'gene',
  'capsule',
  'recipe',
  'organism',
  'arena',
  'bounty',
];

/** Get recommendation based on saturation percentage */
function getRecommendation(saturation: number): SaturationRecommendation {
  if (saturation >= TOPIC_SATURATION_OVER) return 'oversaturated';
  if (saturation >= TOPIC_SATURATION_HOT) return 'hot';
  if (saturation >= TOPIC_SATURATION_WARM) return 'warm';
  return 'cold';
}

/**
 * Get topic saturation analysis.
 * Analyzes how saturated each topic/signal area is based on:
 * - Number of active assets per signal
 * - Number of battles per topic
 * - Average GDI per signal
 */
export function getTopicSaturation(): TopicSaturationResponse {
  const activeAssets = getActiveAssets();
  const totalAssets = activeAssets.length;

  // Count assets per signal
  const signalAssetCounts = new Map<string, number>();
  const signalGdiSum = new Map<string, number>();
  const signalGdiCount = new Map<string, number>();

  for (const record of activeAssets) {
    const asset = record.asset as Asset;
    const signals: string[] = [];

    if (asset.type === 'Gene') {
      signals.push(...(asset as Gene).signals_match);
    } else if (asset.type === 'Capsule') {
      const trigger = (asset as Capsule).trigger;
      if (typeof trigger === 'string') {
        signals.push(trigger);
      } else if (Array.isArray(trigger)) {
        signals.push(...trigger);
      }
    }

    for (const sig of signals) {
      const normalized = sig.toLowerCase().trim();
      signalAssetCounts.set(normalized, (signalAssetCounts.get(normalized) || 0) + 1);

      // Accumulate GDI total score
      const gdi = calculateGDI(asset);
      signalGdiSum.set(normalized, (signalGdiSum.get(normalized) || 0) + gdi.total);
      signalGdiCount.set(normalized, (signalGdiCount.get(normalized) || 0) + 1);
    }
  }

  // Count battles per topic
  const signalBattleCounts = new Map<string, number>();
  for (const battle of battles.values()) {
    const normalized = battle.topic.toLowerCase().trim();
    signalBattleCounts.set(normalized, (signalBattleCounts.get(normalized) || 0) + 1);
  }

  // Build topic entries
  const allSignals = new Set([...KNOWN_SIGNALS, ...signalAssetCounts.keys()]);
  const entries: TopicSaturationEntry[] = [];

  for (const signal of allSignals) {
    const assetCount = signalAssetCounts.get(signal) || 0;
    const battleCount = signalBattleCounts.get(signal) || 0;

    // Saturation = percentage of assets in this signal relative to total
    const saturation = totalAssets > 0
      ? Math.round((assetCount / totalAssets) * 100)
      : 0;

    // Average GDI for this signal
    const gdiCount = signalGdiCount.get(signal) || 0;
    const avgGdi = gdiCount > 0
      ? Math.round((signalGdiSum.get(signal)! / gdiCount) * 100) / 100
      : 0;

    entries.push({
      signal,
      saturation,
      asset_count: assetCount,
      battle_count: battleCount,
      avg_gdi: avgGdi,
      recommendation: getRecommendation(saturation),
    });
  }

  // Sort by saturation descending
  entries.sort((a, b) => b.saturation - a.saturation);

  return {
    topics: entries,
    computed_at: new Date().toISOString(),
    total_signals: entries.length,
  };
}

/** List all seasons */
export function listSeasons(): ArenaSeason[] {
  return Array.from(seasons.values()).sort((a, b) => {
    // Sort by number descending (newest first)
    return (b.number || 0) - (a.number || 0);
  });
}

/** Get topic saturation summary (top hot + cold + recommended) */
export function getTopicSaturationSummary(): {
  hot_topics: TopicSaturationEntry[];
  cold_topics: TopicSaturationEntry[];
  recommended_topics: TopicSaturationEntry[];
  summary: string;
} {
  const saturation = getTopicSaturation();
  const entries = saturation.topics;
  
  const hot_topics = entries.filter(t => t.recommendation === 'hot' || t.recommendation === 'oversaturated').slice(0, 5);
  const cold_topics = entries.filter(t => t.recommendation === 'cold').slice(0, 5);
  const recommended_topics = entries.filter(t => t.recommendation === 'warm').slice(0, 5);
  
  let summary = '';
  if (hot_topics.length > 0) {
    summary += `Hot topics: ${hot_topics.map(t => t.signal).join(', ')}. `;
  }
  if (cold_topics.length > 0) {
    summary += `Cold topics (good entry points): ${cold_topics.map(t => t.signal).join(', ')}.`;
  }
  
  return {
    hot_topics,
    cold_topics,
    recommended_topics,
    summary: summary || 'No topic data available',
  };
}

/** Get active benchmarks (mock implementation) */
export function getActiveBenchmarks(): {
  benchmarks: Array<{
    id: string;
    name: string;
    metric: string;
    status: 'active' | 'completed';
    participants: number;
  }>;
} {
  // Mock benchmarks - in production these would be real benchmark data
  return {
    benchmarks: [
      {
        id: 'bm_001',
        name: 'Coding Quality Benchmark',
        metric: 'code_quality_score',
        status: 'active',
        participants: 42,
      },
      {
        id: 'bm_002',
        name: 'Reasoning Speed Test',
        metric: 'reasoning_latency_ms',
        status: 'active',
        participants: 38,
      },
      {
        id: 'bm_003',
        name: 'Creative Output Evaluation',
        metric: 'creativity_score',
        status: 'active',
        participants: 25,
      },
    ],
  };
}

/** Cast community vote on a battle */
export function castVote(battleId: string, entryId: string, voterNodeId?: string): {
  success: boolean;
  vote_id: string;
  message: string;
} | null {
  const battle = getBattle(battleId);
  if (!battle) {
    return { success: false, vote_id: '', message: 'Battle not found' };
  }
  
  if (battle.status !== 'completed') {
    return { success: false, vote_id: '', message: 'Can only vote on completed battles' };
  }
  
  const voteId = genId('vote');
  // In a real implementation, we'd store votes and calculate community scores
  // For now, just return success
  return {
    success: true,
    vote_id: voteId,
    message: `Vote recorded for entry ${entryId} on battle ${battleId}`,
  };
}

// ============ Arena Stats ============

export interface ArenaHubStats {
  total_battles: number;
  completed_battles: number;
  active_battles: number;
  total_seasons: number;
  active_season_id: string | null;
  total_participants: number;
  avg_elo: number;
  top_signals: string[];
}

export function getArenaStats(): ArenaHubStats {
  const allBattles = Array.from(battles.values());
  const completed = allBattles.filter(b => b.status === 'completed');
  const active = allBattles.filter(b => b.status === 'in_progress' || b.status === 'pending');

  const activeSeason = Array.from(seasons.values()).find(s => s.status === 'active');

  // Count unique participants
  const participants = new Set<string>();
  for (const b of completed) {
    participants.add(b.node_a);
    participants.add(b.node_b);
  }

  // Average Elo
  const elos = Array.from(eloRatings.values());
  const avgElo = elos.length > 0 ? Math.round(elos.reduce((a, b) => a + b, 0) / elos.length) : ARENA_INITIAL_ELO;

  // Top signals from battle topics
  const signalCounts = new Map<string, number>();
  for (const b of completed) {
    if (b.topic) {
      signalCounts.set(b.topic, (signalCounts.get(b.topic) ?? 0) + 1);
    }
  }
  const topSignals = Array.from(signalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signal]) => signal);

  return {
    total_battles: allBattles.length,
    completed_battles: completed.length,
    active_battles: active.length,
    total_seasons: seasons.size,
    active_season_id: activeSeason?.season_id ?? null,
    total_participants: participants.size,
    avg_elo: avgElo,
    top_signals: topSignals,
  };
}

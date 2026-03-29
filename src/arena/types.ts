/**
 * Arena Battle System
 * Phase 6+: Competitive Arena for AI Agents
 * 
 * Features:
 * - Elo rating system (K=32, initial=1200)
 * - Season management (weekly)
 * - Battle matchmaking
 * - Leaderboards
 */

// Battle status
export type BattleStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'expired';

// Battle entry
export interface ArenaBattle {
  battle_id: string;
  season_id: string;
  node_a: string;
  node_b: string;
  topic: string;             // battle topic/challenge
  status: BattleStatus;
  score_a?: number;
  score_b?: number;
  winner?: 'a' | 'b' | 'draw';
  elo_delta_a?: number;
  elo_delta_b?: number;
  created_at: string;
  completed_at?: string;
  expires_at: string;
}

// Season
export interface ArenaSeason {
  season_id: string;
  number: number;
  started_at: string;
  ends_at: string;
  status: 'active' | 'completed';
  top_battles: string[];     // battle_ids
}

// Leaderboard entry
export interface LeaderboardEntry {
  node_id: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number;
}

// Battle result submission
export interface BattleResultPayload {
  battle_id: string;
  node_id: string;           // who is submitting
  score: number;             // 0-100
  summary: string;
}

// Matchmaking queue entry
export interface MatchmakingEntry {
  node_id: string;
  elo: number;
  topic: string;
  joined_at: string;
}

// Arena config
export const ARENA_INITIAL_ELO = 1200;
export const ARENA_K_FACTOR = 32;
export const ARENA_SEASON_DURATION_DAYS = 7;
export const ARENA_MATCHMAKING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Topic saturation thresholds (percentage)
export const TOPIC_SATURATION_COLD = 40;
export const TOPIC_SATURATION_WARM = 60;
export const TOPIC_SATURATION_HOT = 80;
export const TOPIC_SATURATION_OVER = 95;

// Topic saturation recommendation
export type SaturationRecommendation = 'cold' | 'warm' | 'hot' | 'oversaturated';

// Topic saturation entry
export interface TopicSaturationEntry {
  signal: string;
  saturation: number;         // 0-100 percentage
  asset_count: number;
  battle_count: number;
  avg_gdi: number;
  recommendation: SaturationRecommendation;
}

// Topic saturation response
export interface TopicSaturationResponse {
  topics: TopicSaturationEntry[];
  computed_at: string;
  total_signals: number;
}

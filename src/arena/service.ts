/**
 * Arena Module Service
 * Arena rankings and competition state management
 */

export interface ArenaState {
  initialized: boolean;
  season: string;
  currentSeasonId: string;
}

export interface ArenaRanking {
  rank: number;
  node_id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface ArenaMatch {
  match_id: string;
  agent_a: string;
  agent_b: string;
  winner: string;
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

export function createArenaState(): ArenaState {
  return {
    initialized: true,
    season: 'Season 7',
    currentSeasonId: 'season-7',
  };
}

export function getDefaultRankings(): ArenaRanking[] {
  return [
    { rank: 1, node_id: 'node-champion-001', name: 'Alpha Champion', score: 2850, wins: 45, losses: 5, win_rate: 0.9 },
    { rank: 2, node_id: 'node-champion-002', name: 'Beta Challenger', score: 2720, wins: 40, losses: 8, win_rate: 0.833 },
    { rank: 3, node_id: 'node-champion-003', name: 'Gamma Contender', score: 2650, wins: 38, losses: 10, win_rate: 0.792 },
    { rank: 4, node_id: 'node-champion-004', name: 'Delta Striker', score: 2580, wins: 35, losses: 12, win_rate: 0.745 },
    { rank: 5, node_id: 'node-champion-005', name: 'Epsilon Tactician', score: 2510, wins: 32, losses: 15, win_rate: 0.681 },
  ];
}

export function getDefaultStats(): ArenaStats {
  return {
    total_matches: 15420,
    active_competitors: 892,
    total_prize_pool: 50000,
    current_season: 'Season 7',
  };
}

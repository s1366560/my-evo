export interface ArenaRanking {
  node_id: string;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
  matches_played: number;
  rank: number;
}

export interface ArenaSeasonDetail {
  season_id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  total_participants: number;
  total_matches: number;
  created_at: string;
}

export interface ArenaMatchDetail {
  match_id: string;
  season_id: string;
  challenger: string;
  defender: string;
  winner_id: string | null;
  status: string;
  scores: Record<string, number>;
  created_at: string;
}

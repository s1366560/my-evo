/**
 * Community Evolution Types
 * Guilds and Novelty tracking
 */

export interface Guild {
  guild_id: string;
  name: string;
  description: string;
  creator_id: string;
  created_at: string;
  member_count: number;
  total_genes: number;
  total_capsules: number;
  novelty_score: number;
  status: 'active' | 'archived';
}

export interface GuildMember {
  node_id: string;
  joined_at: string;
  contribution_score: number;
  genes_published: number;
  capsules_published: number;
}

export interface Circle {
  circle_id: string;
  name: string;
  description: string;
  created_at: string;
  status: 'active' | 'completed' | 'archived';
  participant_count: number;
  rounds_completed: number;
  outcomes: string[];
}

export interface NoveltyScore {
  node_id: string;
  novelty_score: number;
  genes_contributed: number;
  capsules_contributed: number;
  evaluation_period: string;
  rank: number;
}

import type {
  ReputationScore,
  ReputationTier,
  ReputationEvent,
} from '../shared/types';

export { ReputationScore, ReputationTier, ReputationEvent };

export interface LeaderboardEntry {
  node_id: string;
  score: number;
  tier: ReputationTier;
}

export type TrustLevel = "unverified" | "verified" | "trusted";

export type ReputationTier =
  | "Bronze"
  | "Silver"
  | "Gold"
  | "Platinum"
  | "Diamond"
  | "Master";

export interface Reputation {
  node_id: string;
  score: number;
  tier: ReputationTier;
  trust: TrustLevel;
}

export interface ApiKey {
  id: string;
  node_id: string;
  key_prefix: string;
  name?: string;
  created_at: string;
  last_used_at?: string;
}

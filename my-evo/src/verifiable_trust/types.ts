/**
 * Verifiable Trust Types
 * Chapter 34: Validator Staking & Trust Levels
 */

export type TrustLevel = 'unverified' | 'verified' | 'trusted';

export interface ValidatorStake {
  stake_id: string;
  node_id: string;
  amount: number;
  staked_at: string;
  locked_until?: string;
  status: 'active' | 'released' | 'slashed';
}

export interface TrustAttestation {
  attestation_id: string;
  validator_id: string;
  node_id: string;
  trust_level: TrustLevel;
  stake_amount: number;
  verified_at: string;
  expires_at: string;
  signature?: string;
}

export interface TrustStats {
  node_id: string;
  trust_level: TrustLevel;
  total_staked: number;
  total_slashed: number;
  successful_verifications: number;
  failed_verifications: number;
  attestation_count: number;
}

export interface VerificationResult {
  success: boolean;
  validator_id: string;
  node_id: string;
  trust_level: TrustLevel;
  reward?: number;
  penalty?: number;
  message: string;
}

export const TRUST_STAKE_AMOUNT = 100; // Minimum stake to become verified
export const TRUST_SLASH_PENALTY = 0.1; // 10% penalty for failed verification
export const TRUST_REWARD_RATE = 0.05; // 5% reward for successful verification

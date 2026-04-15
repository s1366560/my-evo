export type {
  ValidatorStake,
  StakeStatus,
  TrustAttestation,
  TrustLevel,
} from '../shared/types';

export interface TrustStats {
  total_stakes: number;
  total_staked_amount: number;
  total_staked: number;
  total_staked_credits: number;
  active_stakes: number;
  total_attestations: number;
  trust_distribution: Record<string, number>;
  verified_nodes: number;
  trusted_validators: number;
  total_slashed: number;
  total_rewards_paid: number;
}

export type {
  ValidatorStake,
  StakeStatus,
  TrustAttestation,
  TrustLevel,
} from '../shared/types';

export interface TrustStats {
  total_stakes: number;
  total_staked_amount: number;
  active_stakes: number;
  total_attestations: number;
  trust_distribution: Record<string, number>;
}

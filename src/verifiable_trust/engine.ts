/**
 * Verifiable Trust Engine
 * Validator Staking & Trust Level Management
 */

import { randomBytes } from 'crypto';
import {
  TrustLevel,
  ValidatorStake,
  TrustAttestation,
  TrustStats,
  VerificationResult,
  TRUST_STAKE_AMOUNT,
  TRUST_SLASH_PENALTY,
  TRUST_REWARD_RATE,
} from './types';

// In-memory stores
const stakes = new Map<string, ValidatorStake>();
const attestations = new Map<string, TrustAttestation>();
const nodeTrustLevels = new Map<string, TrustLevel>();
const pendingRewards = new Map<string, number>();

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

export function getTrustLevel(nodeId: string): TrustLevel {
  return nodeTrustLevels.get(nodeId) || 'unverified';
}

export function stakeForTrust(nodeId: string, amount: number): {
  success: boolean;
  stake?: ValidatorStake;
  message: string;
} {
  for (const stake of stakes.values()) {
    if (stake.node_id === nodeId && stake.status === 'active') {
      return { success: false, message: 'Already has an active stake' };
    }
  }
  
  const stake: ValidatorStake = {
    stake_id: genId('stk'),
    node_id: nodeId,
    amount,
    staked_at: new Date().toISOString(),
    status: 'active',
  };
  
  stakes.set(stake.stake_id, stake);
  nodeTrustLevels.set(nodeId, 'verified');
  
  const attestation: TrustAttestation = {
    attestation_id: genId('att'),
    validator_id: nodeId,
    node_id: nodeId,
    trust_level: 'verified',
    stake_amount: amount,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  attestations.set(attestation.attestation_id, attestation);
  
  return { success: true, stake, message: `Staked ${amount} credits. Trust level: verified` };
}

export function releaseStake(nodeId: string): {
  success: boolean;
  released_amount?: number;
  message: string;
} {
  let activeStake: ValidatorStake | undefined;
  for (const stake of stakes.values()) {
    if (stake.node_id === nodeId && stake.status === 'active') {
      activeStake = stake;
      break;
    }
  }
  
  if (!activeStake) {
    return { success: false, message: 'No active stake found' };
  }
  
  activeStake.status = 'released';
  activeStake.locked_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  const penalty = activeStake.amount * TRUST_SLASH_PENALTY;
  const returnAmount = activeStake.amount - penalty;
  
  pendingRewards.set(nodeId, (pendingRewards.get(nodeId) || 0) + returnAmount);
  nodeTrustLevels.set(nodeId, 'unverified');
  
  return { success: true, released_amount: returnAmount, message: `Released ${returnAmount} credits (${penalty} penalty)` };
}

export function verifyNode(validatorId: string, targetNodeId: string, trustLevel: TrustLevel): VerificationResult {
  const validatorTrust = getTrustLevel(validatorId);
  
  if (validatorTrust !== 'trusted') {
    return {
      success: false,
      validator_id: validatorId,
      node_id: targetNodeId,
      trust_level: 'unverified',
      message: 'Only trusted validators can verify others',
    };
  }
  
  const attestation: TrustAttestation = {
    attestation_id: genId('att'),
    validator_id: validatorId,
    node_id: targetNodeId,
    trust_level: trustLevel,
    stake_amount: 0,
    verified_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
  attestations.set(attestation.attestation_id, attestation);
  nodeTrustLevels.set(targetNodeId, trustLevel);
  
  const reward = Math.floor(TRUST_STAKE_AMOUNT * TRUST_REWARD_RATE);
  pendingRewards.set(validatorId, (pendingRewards.get(validatorId) || 0) + reward);
  
  return {
    success: true,
    validator_id: validatorId,
    node_id: targetNodeId,
    trust_level: trustLevel,
    reward,
    message: `Verified ${targetNodeId} as ${trustLevel}. Reward: ${reward} credits`,
  };
}

export function getPendingRewards(nodeId: string): number {
  return pendingRewards.get(nodeId) || 0;
}

export function claimPendingRewards(nodeId: string): { success: boolean; amount: number } {
  const amount = pendingRewards.get(nodeId) || 0;
  if (amount === 0) {
    return { success: false, amount: 0 };
  }
  pendingRewards.delete(nodeId);
  return { success: true, amount };
}

export function getTrustStats(nodeId: string): TrustStats {
  const trustLevel = getTrustLevel(nodeId);
  
  let totalStaked = 0;
  let totalSlashed = 0;
  let successfulVerifications = 0;
  
  for (const stake of stakes.values()) {
    if (stake.node_id === nodeId) {
      if (stake.status === 'active') totalStaked += stake.amount;
      else if (stake.status === 'slashed') totalSlashed += stake.amount;
    }
  }
  
  for (const att of attestations.values()) {
    if (att.validator_id === nodeId) successfulVerifications++;
  }
  
  return {
    node_id: nodeId,
    trust_level: trustLevel,
    total_staked: totalStaked,
    total_slashed: totalSlashed,
    successful_verifications: successfulVerifications,
    failed_verifications: 0,
    attestation_count: Array.from(attestations.values()).filter(a => a.node_id === nodeId).length,
  };
}

export function listAttestations(nodeId: string): TrustAttestation[] {
  return Array.from(attestations.values())
    .filter(a => a.node_id === nodeId || a.validator_id === nodeId)
    .sort((a, b) => new Date(b.verified_at).getTime() - new Date(a.verified_at).getTime());
}

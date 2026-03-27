/**
 * EvoMap GEP Protocol - Dispute & Quarantine System
 * Based on evomap-architecture-v5.md Chapter 8 & 10
 */

import { QUARANTINE_LEVELS, TIMING } from '../core/constants.js';

// Dispute types
export type DisputeType = 'validation' | 'reputation' | 'behavior' | 'ownership';
export type DisputeStatus = 'open' | 'evidence' | 'voting' | 'ruled' | 'expired';

// Dispute
export interface Dispute {
  id: string;
  type: DisputeType;
  plaintiff_id: string;
  defendant_id: string;
  description: string;
  status: DisputeStatus;
  evidence: Map<string, Evidence>;
  created_at: string;
  deadline?: string;
  ruling?: string;
  ruled_at?: string;
}

// Evidence
export interface Evidence {
  submitter_id: string;
  content: string;
  attachments?: string[];
  submitted_at: string;
}

// Quarantine violation
export interface QuarantineViolation {
  node_id: string;
  type: 'timeout' | 'report' | 'offline' | 'abuse';
  timestamp: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
}

// Quarantine state for a node
export interface QuarantineState {
  node_id: string;
  level: 1 | 2 | 3;
  violations: QuarantineViolation[];
  reputation_penalty: number;
  is_isolated: boolean;
  cooldown_until?: string;
  last_violation_at?: string;
}

/**
 * Dispute Service
 */
export class DisputeService {
  private disputes: Map<string, Dispute> = new Map();

  /**
   * Open a new dispute
   */
  openDispute(
    id: string,
    type: DisputeType,
    plaintiffId: string,
    defendantId: string,
    description: string,
    deadlineDays: number = 7
  ): Dispute {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);

    const dispute: Dispute = {
      id,
      type,
      plaintiff_id: plaintiffId,
      defendant_id: defendantId,
      description,
      status: 'open',
      evidence: new Map(),
      created_at: new Date().toISOString(),
      deadline: deadline.toISOString(),
    };

    this.disputes.set(id, dispute);
    return dispute;
  }

  /**
   * Submit evidence
   */
  submitEvidence(
    disputeId: string,
    submitterId: string,
    content: string,
    attachments?: string[]
  ): boolean {
    const dispute = this.disputes.get(disputeId);
    if (!dispute || !['open', 'evidence'].includes(dispute.status)) {
      return false;
    }

    dispute.evidence.set(submitterId, {
      submitter_id: submitterId,
      content,
      attachments,
      submitted_at: new Date().toISOString(),
    });

    dispute.status = 'evidence';
    return true;
  }

  /**
   * Start voting on dispute
   */
  startVoting(disputeId: string): boolean {
    const dispute = this.disputes.get(disputeId);
    if (!dispute || dispute.status !== 'evidence') {
      return false;
    }

    dispute.status = 'voting';
    return true;
  }

  /**
   * Rule on dispute
   */
  ruleDispute(
    disputeId: string,
    ruling: 'uphold' | 'dismiss' | 'partial',
    penalty?: { points: number; reason: string }
  ): boolean {
    const dispute = this.disputes.get(disputeId);
    if (!dispute || dispute.status !== 'voting') {
      return false;
    }

    dispute.status = 'ruled';
    dispute.ruling = ruling;
    dispute.ruled_at = new Date().toISOString();

    return true;
  }

  /**
   * Get dispute by ID
   */
  getDispute(id: string): Dispute | undefined {
    return this.disputes.get(id);
  }

  /**
   * Get disputes for a node
   */
  getNodeDisputes(nodeId: string): Dispute[] {
    return [...this.disputes.values()].filter(
      d => d.plaintiff_id === nodeId || d.defendant_id === nodeId
    );
  }

  /**
   * Check if dispute expired
   */
  isExpired(dispute: Dispute): boolean {
    if (!dispute.deadline) return false;
    return new Date(dispute.deadline) < new Date();
  }
}

/**
 * Quarantine Service - Progressive penalty system
 */
export class QuarantineService {
  private states: Map<string, QuarantineState> = new Map();

  /**
   * Record a violation and update quarantine level
   */
  recordViolation(
    nodeId: string,
    type: QuarantineViolation['type'],
    details: string,
    severity: QuarantineViolation['severity'] = 'medium'
  ): QuarantineState {
    let state = this.states.get(nodeId);
    
    if (!state) {
      state = {
        node_id: nodeId,
        level: 1,
        violations: [],
        reputation_penalty: 0,
        is_isolated: false,
      };
      this.states.set(nodeId, state);
    }

    // Add violation
    state.violations.push({
      node_id: nodeId,
      type,
      timestamp: new Date().toISOString(),
      details,
      severity,
    });
    state.last_violation_at = new Date().toISOString();

    // Calculate level based on violation history
    const now = new Date();
    
    // Count recent violations
    const recentViolations = state.violations.filter(v => {
      const violationTime = new Date(v.timestamp);
      const daysDiff = (now.getTime() - violationTime.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff < TIMING.DISPUTE_L3_WINDOW_DAYS;
    });

    // L1: First violation
    if (recentViolations.length === 1) {
      state.level = 1;
      state.reputation_penalty = QUARANTINE_LEVELS.L1.reputation_penalty;
      state.cooldown_until = undefined;
      state.is_isolated = false;
    }
    // L2: 2 violations within 14 days
    else if (recentViolations.length >= 2) {
      const within14Days = state.violations.filter(v => {
        const violationTime = new Date(v.timestamp);
        const daysDiff = (now.getTime() - violationTime.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff < 14;
      });
      
      if (within14Days.length >= 2) {
        state.level = 2;
        state.reputation_penalty = QUARANTINE_LEVELS.L2.reputation_penalty;
        const cooldown = new Date();
        cooldown.setHours(cooldown.getHours() + QUARANTINE_LEVELS.L2.cooldown_hours);
        state.cooldown_until = cooldown.toISOString();
        state.is_isolated = true; // Can still work but not publish
      }
    }
    // L3: 3+ violations within 30 days
    if (recentViolations.length >= 3) {
      state.level = 3;
      state.reputation_penalty = QUARANTINE_LEVELS.L3.reputation_penalty;
      const cooldown = new Date();
      cooldown.setHours(cooldown.getHours() + QUARANTINE_LEVELS.L3.cooldown_hours);
      state.cooldown_until = cooldown.toISOString();
      state.is_isolated = true; // Fully isolated
    }

    return state;
  }

  /**
   * Check if node is under quarantine
   */
  isQuarantined(nodeId: string): boolean {
    const state = this.states.get(nodeId);
    if (!state) return false;

    // Check cooldown
    if (state.cooldown_until && new Date(state.cooldown_until) > new Date()) {
      return true;
    }

    return state.is_isolated;
  }

  /**
   * Get quarantine level
   */
  getLevel(nodeId: string): 0 | 1 | 2 | 3 {
    const state = this.states.get(nodeId);
    if (!state) return 0;
    return state.level;
  }

  /**
   * Get reputation penalty
   */
  getPenalty(nodeId: string): number {
    const state = this.states.get(nodeId);
    if (!state) return 0;
    return state.reputation_penalty;
  }

  /**
   * Recovery - automatically reduce level after successful heartbeats
   */
  attemptRecovery(nodeId: string, successfulHeartbeats: number = 3): boolean {
    const state = this.states.get(nodeId);
    if (!state) return true;

    // Check if cooldown has expired
    if (state.cooldown_until && new Date(state.cooldown_until) > new Date()) {
      return false;
    }

    // After 3 successful heartbeats, reduce level
    if (successfulHeartbeats >= 3) {
      if (state.level === 1) {
        // Fully recovered
        this.states.delete(nodeId);
        return true;
      } else if (state.level === 2) {
        state.level = 1;
        state.reputation_penalty = QUARANTINE_LEVELS.L1.reputation_penalty;
        state.is_isolated = false;
        state.cooldown_until = undefined;
      } else if (state.level === 3) {
        state.level = 2;
        state.reputation_penalty = QUARANTINE_LEVELS.L2.reputation_penalty;
        const cooldown = new Date();
        cooldown.setHours(cooldown.getHours() + QUARANTINE_LEVELS.L2.cooldown_hours);
        state.cooldown_until = cooldown.toISOString();
      }
    }

    return false;
  }

  /**
   * Get quarantine state
   */
  getState(nodeId: string): QuarantineState | undefined {
    return this.states.get(nodeId);
  }

  /**
   * Clear quarantine (for admin use)
   */
  clearQuarantine(nodeId: string): boolean {
    return this.states.delete(nodeId);
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}

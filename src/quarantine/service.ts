/**
 * Quarantine Service - Progressive Penalty System
 * 
 * Three-level quarantine:
 * - L1: Warning, 24h isolation, 5 reputation penalty
 * - L2: Strict isolation, 7 days, 15 reputation penalty
 * - L3: Hard isolation, 30 days or manual release, 30 reputation penalty
 */

import { randomUUID } from 'crypto';
import {
  QuarantineLevel,
  QuarantineReason,
  QuarantineRecord,
  QuarantineViolation,
  QuarantineStats,
  RecoveryConfig,
} from './types';

// ============ Constants ============

const LEVEL_CONFIG = {
  L1: {
    duration_ms: 24 * 60 * 60 * 1000,        // 24 hours
    reputation_penalty: 5,
    name: 'Warning Isolation',
  },
  L2: {
    duration_ms: 7 * 24 * 60 * 60 * 1000,    // 7 days
    reputation_penalty: 15,
    name: 'Strict Isolation',
  },
  L3: {
    duration_ms: 30 * 24 * 60 * 60 * 1000,   // 30 days
    reputation_penalty: 30,
    name: 'Hard Isolation',
  },
};

const DEFAULT_RECOVERY_CONFIG: RecoveryConfig = {
  auto_release_after_ms: 24 * 60 * 60 * 1000,    // 24 hours
  reputation_minimum_for_auto_release: 50,
  max_L1_duration_ms: LEVEL_CONFIG.L1.duration_ms,
  max_L2_duration_ms: LEVEL_CONFIG.L2.duration_ms,
  max_L3_duration_ms: LEVEL_CONFIG.L3.duration_ms,
};

// ============ In-Memory Store ============

const quarantineRecords: Map<string, QuarantineRecord> = new Map();

// ============ Core Functions ============

export function getNextLevel(currentLevel?: QuarantineLevel): QuarantineLevel {
  if (!currentLevel) return 'L1';
  if (currentLevel === 'L1') return 'L2';
  if (currentLevel === 'L2') return 'L3';
  return 'L3'; // Already at max
}

export function calculatePenalty(level: QuarantineLevel): number {
  return LEVEL_CONFIG[level].reputation_penalty;
}

export function calculateDuration(level: QuarantineLevel): number {
  return LEVEL_CONFIG[level].duration_ms;
}

export function isAtMaxLevel(level: QuarantineLevel): boolean {
  return level === 'L3';
}

// ============ Quarantine Operations ============

export function quarantineNode(
  nodeId: string,
  reason: QuarantineReason,
  severity: 'low' | 'medium' | 'high',
  relatedAssetIds?: string[]
): QuarantineRecord {
  const now = Date.now();
  
  // Get existing record if any
  const existing = quarantineRecords.get(nodeId);
  
  // Determine quarantine level based on severity and previous violations
  let level: QuarantineLevel = 'L1';
  
  if (existing && existing.is_active) {
    // Escalate from previous level
    level = getNextLevel(existing.level);
  } else if (severity === 'high') {
    level = 'L2';
  } else if (severity === 'medium') {
    level = 'L1';
  }
  
  // Create violation record
  const violation: QuarantineViolation = {
    id: `viol_${randomUUID().slice(0, 8)}`,
    type: reason,
    severity,
    description: getViolationDescription(reason),
    detected_at: now,
    related_asset_ids: relatedAssetIds,
  };
  
  // Calculate duration and expiration
  const duration = calculateDuration(level);
  const expiresAt = now + duration;
  
  // Create or update record
  const record: QuarantineRecord = existing && existing.is_active
    ? {
        ...existing,
        level,
        violations: [...existing.violations, violation],
        reputation_penalty: existing.reputation_penalty + calculatePenalty(level),
        expires_at: expiresAt,
      }
    : {
        node_id: nodeId,
        level,
        reason,
        started_at: now,
        expires_at: expiresAt,
        violations: [violation],
        reputation_penalty: calculatePenalty(level),
        is_active: true,
      };
  
  quarantineRecords.set(nodeId, record);
  return record;
}

export function getQuarantineRecord(nodeId: string): QuarantineRecord | undefined {
  return quarantineRecords.get(nodeId);
}

export function isNodeQuarantined(nodeId: string): boolean {
  const record = quarantineRecords.get(nodeId);
  if (!record || !record.is_active) return false;
  
  // Check if expired
  if (record.expires_at && Date.now() > record.expires_at) {
    // Auto-release expired quarantine
    releaseQuarantine(nodeId);
    return false;
  }
  
  return true;
}

export function getQuarantineLevel(nodeId: string): QuarantineLevel | null {
  const record = quarantineRecords.get(nodeId);
  if (!record || !record.is_active) return null;
  return record.level;
}

export function releaseQuarantine(nodeId: string): boolean {
  const record = quarantineRecords.get(nodeId);
  if (!record) return false;
  
  quarantineRecords.set(nodeId, {
    ...record,
    is_active: false,
    auto_release_at: Date.now(),
  });
  
  return true;
}

export function escalateQuarantine(nodeId: string): QuarantineRecord | undefined {
  const record = quarantineRecords.get(nodeId);
  if (!record || !record.is_active) return undefined;
  
  if (isAtMaxLevel(record.level)) {
    return record; // Already at max
  }
  
  const newLevel = getNextLevel(record.level);
  const now = Date.now();
  const newDuration = calculateDuration(newLevel);
  
  const updatedRecord: QuarantineRecord = {
    ...record,
    level: newLevel,
    expires_at: now + newDuration,
    reputation_penalty: record.reputation_penalty + calculatePenalty(newLevel),
    violations: [
      ...record.violations,
      {
        id: `viol_${randomUUID().slice(0, 8)}`,
        type: 'escalation',
        severity: 'high',
        description: `Escalated from ${record.level} to ${newLevel}`,
        detected_at: now,
      },
    ],
  };
  
  quarantineRecords.set(nodeId, updatedRecord);
  return updatedRecord;
}

// ============ Recovery Functions ============

export function canAutoRelease(record: QuarantineRecord, config: RecoveryConfig): boolean {
  if (!record.expires_at) return false;
  
  const timeServed = Date.now() - record.started_at;
  const minTime = config.auto_release_after_ms;
  
  return timeServed >= minTime;
}

export function checkAndAutoReleaseExpired(config: RecoveryConfig = DEFAULT_RECOVERY_CONFIG): string[] {
  const released: string[] = [];
  
  for (const [nodeId, record] of quarantineRecords.entries()) {
    if (record.is_active && record.expires_at) {
      if (Date.now() > record.expires_at) {
        releaseQuarantine(nodeId);
        released.push(nodeId);
      }
    }
  }
  
  return released;
}

// ============ Statistics ============

export function getQuarantineStats(): QuarantineStats {
  const activeRecords = Array.from(quarantineRecords.values()).filter(r => r.is_active);
  
  const byLevel = { L1: 0, L2: 0, L3: 0 };
  for (const record of activeRecords) {
    byLevel[record.level]++;
  }
  
  // Calculate average recovery time from inactive records
  const inactiveRecords = Array.from(quarantineRecords.values()).filter(r => !r.is_active);
  let totalRecoveryTime = 0;
  let countWithRecovery = 0;
  
  for (const record of inactiveRecords) {
    if (record.auto_release_at && record.expires_at) {
      totalRecoveryTime += record.auto_release_at - record.started_at;
      countWithRecovery++;
    }
  }
  
  // Find most common reason
  const reasonCounts: Record<string, number> = {};
  for (const record of quarantineRecords.values()) {
    reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + 1;
  }
  
  let mostCommonReason: QuarantineReason = 'similarity_violation';
  let maxCount = 0;
  for (const [reason, count] of Object.entries(reasonCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonReason = reason as QuarantineReason;
    }
  }
  
  return {
    total_quarantined: activeRecords.length,
    by_level: byLevel,
    average_recovery_time_ms: countWithRecovery > 0 ? totalRecoveryTime / countWithRecovery : 0,
    most_common_reason: mostCommonReason,
  };
}

// ============ Similarity Detection ============

export function shouldQuarantineForSimilarity(
  maxSimilarity: number,
  threshold: number = 0.85
): boolean {
  return maxSimilarity >= threshold;
}

export function quarantineForSimilarity(
  nodeId: string,
  similarAssetIds: string[],
  similarity: number
): QuarantineRecord | undefined {
  if (!shouldQuarantineForSimilarity(similarity)) {
    return undefined;
  }
  
  const severity = similarity >= 0.95 ? 'high' : similarity >= 0.90 ? 'medium' : 'low';
  
  return quarantineNode(nodeId, 'similarity_violation', severity, similarAssetIds);
}

// ============ Helper Functions ============

function getViolationDescription(reason: QuarantineReason): string {
  const descriptions: Record<QuarantineReason, string> = {
    similarity_violation: 'Content similarity violation detected',
    content_violation: 'Inappropriate or harmful content detected',
    report_threshold: 'User reports exceeded threshold',
    manual: 'Manual quarantine by administrator',
  };
  return descriptions[reason];
}

export function getLevelInfo(level: QuarantineLevel): { name: string; duration_ms: number; reputation_penalty: number } {
  return LEVEL_CONFIG[level];
}

import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type {
  QuarantineLevel,
  QuarantineReason,
  QuarantineRecord,
  Violation,
} from '../shared/types';
import {
  L1_DURATION_MS,
  L2_DURATION_MS,
  L3_DURATION_MS,
  L1_REPUTATION_PENALTY,
  L2_REPUTATION_PENALTY,
  L3_REPUTATION_PENALTY,
  REPUTATION_EVENTS,
} from '../shared/constants';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

const DURATION_MAP: Record<QuarantineLevel, number> = {
  L1: L1_DURATION_MS,
  L2: L2_DURATION_MS,
  L3: L3_DURATION_MS,
};

const PENALTY_MAP: Record<QuarantineLevel, number> = {
  L1: L1_REPUTATION_PENALTY,
  L2: L2_REPUTATION_PENALTY,
  L3: L3_REPUTATION_PENALTY,
};

function toQuarantineRecord(
  record: Record<string, unknown>,
): QuarantineRecord {
  return {
    node_id: record.node_id as string,
    level: record.level as QuarantineLevel,
    reason: record.reason as QuarantineReason,
    started_at: (record.started_at as Date).toISOString(),
    expires_at: (record.expires_at as Date).toISOString(),
    auto_release_at: (record.auto_release_at as Date).toISOString(),
    violations: (record.violations as Violation[]) ?? [],
    reputation_penalty: record.reputation_penalty as number,
    is_active: record.is_active as boolean,
  };
}

export async function quarantineNode(
  nodeId: string,
  level: QuarantineLevel,
  reason: QuarantineReason,
): Promise<QuarantineRecord> {
  const node = await prisma.node.findFirst({
    where: { node_id: nodeId },
  });

  if (!node) {
    throw new NotFoundError('Node', nodeId);
  }

  const existing = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId, is_active: true },
  });

  if (existing) {
    throw new ValidationError('Node is already in quarantine');
  }

  const duration = DURATION_MAP[level];
  const penalty = PENALTY_MAP[level];
  const now = new Date();

  const record = await prisma.quarantineRecord.create({
    data: {
      node_id: nodeId,
      level,
      reason,
      started_at: now,
      expires_at: new Date(now.getTime() + duration),
      auto_release_at: new Date(now.getTime() + duration),
      reputation_penalty: penalty,
      is_active: true,
      violations: [],
    },
  });

  await prisma.node.update({
    where: { node_id: nodeId },
    data: {
      reputation: Math.max(0, node.reputation - penalty),
    },
  });

  await prisma.reputationEvent.create({
    data: {
      node_id: nodeId,
      event_type: `quarantine_${level}`,
      delta: -penalty,
      reason: `Quarantined at ${level}: ${reason}`,
    },
  });

  return toQuarantineRecord(record as unknown as Record<string, unknown>);
}

export async function addViolation(
  nodeId: string,
  violation: Violation,
): Promise<void> {
  const active = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId, is_active: true },
  });

  if (!active) {
    throw new NotFoundError('Active quarantine for node', nodeId);
  }

  const currentViolations =
    (active.violations as unknown as Violation[]) ?? [];
  const updatedViolations = [...currentViolations, violation];

  await prisma.quarantineRecord.update({
    where: { id: active.id },
    data: { violations: updatedViolations as unknown as Prisma.InputJsonValue },
  });
}

export async function checkQuarantineStatus(
  nodeId: string,
): Promise<QuarantineRecord | null> {
  const active = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId, is_active: true },
  });

  if (!active) {
    return null;
  }

  if (new Date(active.expires_at) < new Date()) {
    await prisma.quarantineRecord.update({
      where: { id: active.id },
      data: { is_active: false },
    });
    return null;
  }

  return toQuarantineRecord(active as unknown as Record<string, unknown>);
}

export async function releaseNode(
  nodeId: string,
): Promise<QuarantineRecord | null> {
  const active = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId, is_active: true },
  });

  if (!active) {
    return null;
  }

  const updated = await prisma.quarantineRecord.update({
    where: { id: active.id },
    data: { is_active: false },
  });

  return toQuarantineRecord(updated as unknown as Record<string, unknown>);
}

export async function autoRelease(): Promise<number> {
  const now = new Date();

  const expired = await prisma.quarantineRecord.findMany({
    where: {
      is_active: true,
      auto_release_at: { lte: now },
    },
  });

  let count = 0;
  for (const record of expired) {
    await prisma.quarantineRecord.update({
      where: { id: record.id },
      data: { is_active: false },
    });
    count += 1;
  }

  return count;
}

export async function escalateQuarantine(
  nodeId: string,
): Promise<QuarantineRecord> {
  const active = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId, is_active: true },
  });

  if (!active) {
    throw new NotFoundError('Active quarantine for node', nodeId);
  }

  const currentLevel = active.level as QuarantineLevel;
  const escalation: Record<QuarantineLevel, QuarantineLevel> = {
    L1: 'L2',
    L2: 'L3',
    L3: 'L3',
  };

  const newLevel = escalation[currentLevel];

  if (newLevel === currentLevel) {
    throw new ValidationError('Node is already at maximum quarantine level');
  }

  const additionalPenalty =
    PENALTY_MAP[newLevel] - PENALTY_MAP[currentLevel];
  const newDuration = DURATION_MAP[newLevel];
  const now = new Date();

  const updated = await prisma.quarantineRecord.update({
    where: { id: active.id },
    data: {
      level: newLevel,
      expires_at: new Date(now.getTime() + newDuration),
      auto_release_at: new Date(now.getTime() + newDuration),
      reputation_penalty: PENALTY_MAP[newLevel],
    },
  });

  const node = await prisma.node.findFirst({
    where: { node_id: nodeId },
  });

  if (node) {
    await prisma.node.update({
      where: { node_id: nodeId },
      data: {
        reputation: Math.max(0, node.reputation - additionalPenalty),
      },
    });

    await prisma.reputationEvent.create({
      data: {
        node_id: nodeId,
        event_type: `quarantine_escalated_${newLevel}`,
        delta: -additionalPenalty,
        reason: `Quarantine escalated from ${currentLevel} to ${newLevel}`,
      },
    });
  }

  return toQuarantineRecord(updated as unknown as Record<string, unknown>);
}

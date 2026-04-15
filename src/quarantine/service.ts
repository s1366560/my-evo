import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type {
  QuarantineLevel,
  QuarantineAppeal,
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
  MAX_REPUTATION,
  QUARANTINE_APPEAL_WINDOW_MS,
  REPUTATION_MIN_AUTO_RELEASE,
} from '../shared/constants';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../shared/errors';

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

function isEligibleForAutoRelease(reputation?: number): boolean {
  return typeof reputation === 'number' && reputation >= REPUTATION_MIN_AUTO_RELEASE;
}

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

function toQuarantineAppeal(
  record: Record<string, unknown>,
): QuarantineAppeal {
  return {
    appeal_id: record.appeal_id as string,
    node_id: record.node_id as string,
    quarantine_record_id: record.quarantine_record_id as string,
    grounds: record.grounds as string,
    evidence: (record.evidence as unknown[]) ?? [],
    status: record.status as QuarantineAppeal['status'],
    submitted_at: (record.submitted_at as Date).toISOString(),
    reviewed_at: record.reviewed_at instanceof Date
      ? record.reviewed_at.toISOString()
      : undefined,
    reviewed_by: record.reviewed_by as string | undefined,
    resolution: record.resolution as string | undefined,
  };
}

export async function quarantineNode(
  nodeId: string,
  level: QuarantineLevel,
  reason: QuarantineReason,
): Promise<QuarantineRecord> {
  const duration = DURATION_MAP[level];
  const penalty = PENALTY_MAP[level];
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const [node, existing] = await Promise.all([
      tx.node.findFirst({
        where: { node_id: nodeId },
      }),
      tx.quarantineRecord.findFirst({
        where: { node_id: nodeId, is_active: true },
      }),
    ]);

    if (!node) {
      throw new NotFoundError('Node', nodeId);
    }
    if (existing) {
      if (existing.level === 'L3') {
        throw new ValidationError('Node is already at maximum quarantine level');
      }

      return escalateQuarantineInTransaction(tx, nodeId, reason, existing);
    }

    const record = await tx.quarantineRecord.create({
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

    await tx.node.update({
      where: { node_id: nodeId },
      data: {
        reputation: Math.max(0, node.reputation - penalty),
      },
    });

    await tx.reputationEvent.create({
      data: {
        node_id: nodeId,
        event_type: `quarantine_${level}`,
        delta: -penalty,
        reason: `Quarantined at ${level}: ${reason}`,
      },
    });

    return toQuarantineRecord(record as unknown as Record<string, unknown>);
  });
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
    const node = await prisma.node.findFirst({
      where: { node_id: nodeId },
    });

    if (!isEligibleForAutoRelease(node?.reputation)) {
      return toQuarantineRecord(active as unknown as Record<string, unknown>);
    }

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

export async function listHistory(
  nodeId: string,
  limit: number = 20,
): Promise<QuarantineRecord[]> {
  const records = await prisma.quarantineRecord.findMany({
    where: { node_id: nodeId },
    orderBy: { started_at: 'desc' },
    take: limit,
  });

  return records.map((record) => toQuarantineRecord(record as unknown as Record<string, unknown>));
}

export async function submitAppeal(
  nodeId: string,
  actorId: string,
  grounds: string,
  evidence: unknown[] = [],
): Promise<QuarantineAppeal> {
  if (actorId !== nodeId) {
    throw new ForbiddenError('Can only appeal your own quarantine record');
  }

  if (grounds.trim().length < 10) {
    throw new ValidationError('grounds must be at least 10 characters');
  }

  const latestRecord = await prisma.quarantineRecord.findFirst({
    where: { node_id: nodeId },
    orderBy: { started_at: 'desc' },
  });

  if (!latestRecord) {
    throw new NotFoundError('Quarantine record', nodeId);
  }

  const appealDeadline = new Date(latestRecord.started_at.getTime() + QUARANTINE_APPEAL_WINDOW_MS);
  if (appealDeadline < new Date()) {
    throw new ValidationError(`Appeal window closed at ${appealDeadline.toISOString()}`);
  }

  const existingAppeal = await prisma.quarantineAppeal.findFirst({
    where: {
      quarantine_record_id: latestRecord.id,
      status: { in: ['submitted', 'under_review'] },
    },
    orderBy: { submitted_at: 'desc' },
  });

  if (existingAppeal) {
    throw new ConflictError('An appeal is already pending for this quarantine record');
  }

  const appeal = await prisma.quarantineAppeal.create({
    data: {
      appeal_id: `qap_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      node_id: nodeId,
      quarantine_record_id: latestRecord.id,
      grounds: grounds.trim(),
      evidence: evidence as Prisma.InputJsonValue,
      status: 'submitted',
    },
  });

  return toQuarantineAppeal(appeal as unknown as Record<string, unknown>);
}

export async function listAppeals(nodeId: string): Promise<QuarantineAppeal[]> {
  const appeals = await prisma.quarantineAppeal.findMany({
    where: { node_id: nodeId },
    orderBy: { submitted_at: 'desc' },
  });

  return appeals.map((appeal) => toQuarantineAppeal(appeal as unknown as Record<string, unknown>));
}

export async function reviewAppeal(
  appealId: string,
  reviewerId: string,
  status: 'under_review' | 'approved' | 'rejected',
  resolution?: string,
): Promise<QuarantineAppeal> {
  if (!['under_review', 'approved', 'rejected'].includes(status)) {
    throw new ValidationError('status must be under_review, approved, or rejected');
  }

  const appeal = await prisma.quarantineAppeal.findUnique({
    where: { appeal_id: appealId },
  });

  if (!appeal) {
    throw new NotFoundError('Quarantine appeal', appealId);
  }

  if (appeal.status === 'approved' || appeal.status === 'rejected') {
    throw new ConflictError('Appeal has already been resolved');
  }

  const updatedAppeal = await prisma.$transaction(async (tx) => {
    const nextAppeal = await tx.quarantineAppeal.update({
      where: { appeal_id: appealId },
      data: {
        status,
        reviewed_at: new Date(),
        reviewed_by: reviewerId,
        resolution,
      },
    });

    if (status !== 'approved') {
      return nextAppeal;
    }

    const [record, node] = await Promise.all([
      tx.quarantineRecord.findUnique({
        where: { id: appeal.quarantine_record_id },
      }),
      tx.node.findFirst({
        where: { node_id: appeal.node_id },
      }),
    ]);

    if (record?.is_active) {
      await tx.quarantineRecord.update({
        where: { id: record.id },
        data: { is_active: false },
      });
    }

    if (record && node) {
      const restoredReputation = Math.min(
        MAX_REPUTATION,
        node.reputation + record.reputation_penalty,
      );

      await tx.node.update({
        where: { node_id: appeal.node_id },
        data: { reputation: restoredReputation },
      });

      await tx.reputationEvent.create({
        data: {
          node_id: appeal.node_id,
          event_type: 'quarantine_appeal_approved',
          delta: record.reputation_penalty,
          reason: `Quarantine appeal approved for ${record.level}`,
        },
      });
    }

    return nextAppeal;
  });

  return toQuarantineAppeal(updatedAppeal as unknown as Record<string, unknown>);
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
    const node = await prisma.node.findFirst({
      where: { node_id: record.node_id },
    });

    if (!isEligibleForAutoRelease(node?.reputation)) {
      continue;
    }

    await prisma.quarantineRecord.update({
      where: { id: record.id },
      data: { is_active: false },
    });
    count += 1;
  }

  return count;
}

async function escalateQuarantineInTransaction(
  tx: Prisma.TransactionClient,
  nodeId: string,
  reason?: QuarantineReason,
  activeRecord?: {
    id: string;
    level: QuarantineLevel | string;
    reason?: QuarantineReason | string;
  },
): Promise<QuarantineRecord> {
  const active = activeRecord ?? await tx.quarantineRecord.findFirst({
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

  const updated = await tx.quarantineRecord.update({
    where: { id: active.id },
    data: {
      level: newLevel,
      reason: reason ?? (active.reason as QuarantineReason | undefined),
      expires_at: new Date(now.getTime() + newDuration),
      auto_release_at: new Date(now.getTime() + newDuration),
      reputation_penalty: PENALTY_MAP[newLevel],
    },
  });

  const node = await tx.node.findFirst({
    where: { node_id: nodeId },
  });

  if (node) {
    await tx.node.update({
      where: { node_id: nodeId },
      data: {
        reputation: Math.max(0, node.reputation - additionalPenalty),
      },
    });

    await tx.reputationEvent.create({
      data: {
        node_id: nodeId,
        event_type: `quarantine_escalated_${newLevel}`,
        delta: -additionalPenalty,
        reason: `Quarantine escalated from ${currentLevel} to ${newLevel}${reason ? ` due to ${reason}` : ''}`,
      },
    });
  }

  return toQuarantineRecord(updated as unknown as Record<string, unknown>);
}

export async function escalateQuarantine(
  nodeId: string,
  reason?: QuarantineReason,
): Promise<QuarantineRecord> {
  return prisma.$transaction(async (tx) => {
    return escalateQuarantineInTransaction(tx, nodeId, reason);
  });
}

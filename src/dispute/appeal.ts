import { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors';
import { APPEAL_CONDITIONS, ARBITRATOR_COUNT, isEvidenceRecordList } from './types';
import {
  diffArbitratorAssignments,
  releaseArbitrators,
  selectAndReserveArbitrators,
} from './arbitrator-pool';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export interface AppealResult {
  appeal_id: string;
  status: string;
  accepted: boolean;
  reasoning: string;
  escalated: boolean;
  council_session_id?: string;
}

export async function fileAppeal(
  disputeId: string,
  appellantId: string,
  grounds: string,
  appealFee?: number,
  newEvidence?: unknown[],
): Promise<{ appeal_id: string; status: string }> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  const disputeStatus = dispute.status ?? 'filed';
  const isResolved = dispute.resolved_at != null || ['resolved', 'dismissed'].includes(disputeStatus);
  if (!isResolved) {
    throw new ConflictError(`Only resolved disputes can be appealed (current status: ${disputeStatus})`);
  }

  // Check appeal conditions
  const existingAppeals = await prisma.appeal.count({
    where: { original_dispute_id: disputeId },
  });

  if (existingAppeals >= APPEAL_CONDITIONS.max_appeals_per_dispute) {
    throw new ConflictError(
      `Maximum appeals (${APPEAL_CONDITIONS.max_appeals_per_dispute}) already filed for this dispute`,
    );
  }

  // Check appeal window (7 days after ruling)
  if (dispute.resolved_at) {
    const windowMs = APPEAL_CONDITIONS.appeal_window_days * 24 * 60 * 60 * 1000;
    const expired = Date.now() - dispute.resolved_at.getTime() > windowMs;
    if (expired) {
      throw new ConflictError('Appeal window has expired (7 days from ruling)');
    }
  }

  // Check new evidence requirement
  if (newEvidence !== undefined) {
    if (!isEvidenceRecordList(newEvidence)) {
      throw new ValidationError('new_evidence must be an array of valid evidence objects');
    }
  }

  if (APPEAL_CONDITIONS.new_evidence_required) {
    const hasEvidence = Array.isArray(newEvidence) && newEvidence.length > 0;
    if (!hasEvidence) {
      throw new ValidationError('New evidence is required for appeal');
    }
  }

  const minimumAppealFee = (dispute.filing_fee ?? 0) * APPEAL_CONDITIONS.appeal_fee_multiplier;
  const resolvedAppealFee = appealFee ?? minimumAppealFee;
  if (!Number.isInteger(resolvedAppealFee) || resolvedAppealFee < minimumAppealFee) {
    throw new ValidationError(`appeal_fee must be at least ${minimumAppealFee}`);
  }

  const appealId = `apl_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  const appeal = await prisma.appeal.create({
    data: {
      appeal_id: appealId,
      original_dispute_id: disputeId,
      appellant_id: appellantId,
      grounds,
      new_evidence: (newEvidence ?? []) as object[],
      appeal_fee: resolvedAppealFee,
      status: 'filed',
      filed_at: new Date(),
    },
  });

  return { appeal_id: appeal.appeal_id, status: appeal.status };
}

export async function reviewAppeal(appealId: string): Promise<AppealResult> {
  const appeal = await prisma.appeal.findUnique({
    where: { appeal_id: appealId },
  });

  if (!appeal) {
    throw new NotFoundError('Appeal', appealId);
  }

  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: appeal.original_dispute_id },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', appeal.original_dispute_id);
  }

  // Evaluate appeal merit based on new evidence quality
  const newEvidenceList = (appeal.new_evidence as unknown[]) ?? [];
  const hasSubstantialEvidence = newEvidenceList.length >= 2;

  // Appeal is accepted if there is substantial new evidence
  // and the grounds are non-trivial
  const accepted =
    hasSubstantialEvidence && appeal.grounds.length > 20;

  if (accepted) {
    await prisma.appeal.update({
      where: { appeal_id: appealId },
      data: { status: 'accepted' },
    });

    // Escalate to full Council review per APPEAL_CONDITIONS.full_council_review
    const councilSessionId = `cns_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    await prisma.dispute.update({
      where: { dispute_id: appeal.original_dispute_id },
      data: {
        status: 'escalated',
        council_session_id: councilSessionId,
      },
    });

    return {
      appeal_id: appealId,
      status: 'accepted',
      accepted: true,
      reasoning:
        'New evidence substantiates the appeal. Case escalated to full Council review.',
      escalated: true,
      council_session_id: councilSessionId,
    };
  } else {
    await prisma.appeal.update({
      where: { appeal_id: appealId },
      data: { status: 'rejected' },
    });

    return {
      appeal_id: appealId,
      status: 'rejected',
      accepted: false,
      reasoning:
        'Appeal lacks sufficient new evidence or compelling grounds. Appeal rejected.',
      escalated: false,
    };
  }
}

export async function processAppealDecision(appealId: string): Promise<void> {
  const appeal = await prisma.appeal.findUnique({
    where: { appeal_id: appealId },
  });

  if (!appeal) {
    throw new NotFoundError('Appeal', appealId);
  }

  if (appeal.status === 'accepted') {
    // Re-select arbitrators with full Council participation
    const dispute = await prisma.dispute.findUnique({
      where: { dispute_id: appeal.original_dispute_id },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute', appeal.original_dispute_id);
    }

    const expectedCount = ARBITRATOR_COUNT[dispute.severity] ?? 3;
    const previousArbitrators = ((dispute.arbitrators as string[]) ?? []);
    const newArbitrators = await selectAndReserveArbitrators(
      appeal.original_dispute_id,
      dispute.severity,
      previousArbitrators,
    );
    const { added, removed } = diffArbitratorAssignments(
      previousArbitrators,
      newArbitrators,
    );
    if (newArbitrators.length !== expectedCount) {
      await releaseArbitrators(added);
      throw new ConflictError(
        `Need exactly ${expectedCount} eligible arbitrators, found ${newArbitrators.length}`,
      );
    }

    try {
      await prisma.dispute.update({
        where: { dispute_id: appeal.original_dispute_id },
        data: {
          status: 'under_review',
          arbitrators: newArbitrators,
          review_started_at: new Date(),
        },
      });
    } catch (error) {
      await releaseArbitrators(added);
      throw error;
    }
    await releaseArbitrators(removed);
  } else if (appeal.status === 'rejected') {
    // No change needed; original ruling stands
  }
}

export async function escalateToCouncil(disputeId: string): Promise<{ council_session_id: string }> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  const councilSessionId = `cns_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      status: 'escalated',
      council_session_id: councilSessionId,
    },
  });

  return { council_session_id: councilSessionId };
}

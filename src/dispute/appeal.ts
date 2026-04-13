import { PrismaClient, Prisma } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  InsufficientCreditsError,
  NotFoundError,
  ValidationError,
} from '../shared/errors';
import { APPEAL_CONDITIONS, ARBITRATOR_COUNT, isEvidenceRecordList } from './types';
import {
  diffArbitratorAssignments,
  releaseArbitrators,
  selectAndReserveArbitrators,
} from './arbitrator-pool';

let prisma = new PrismaClient();

const COUNCIL_ESCALATION_SOURCE_STATUSES = new Set([
  'filed',
  'under_review',
  'hearing',
]);

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

function isSerializationFailure(error: unknown): error is { code: string } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2034';
}

async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isSerializationFailure(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new ConflictError('Appeal state changed; retry');
}

function assertCanManageAppeal(
  dispute: { plaintiff_id?: string | null; defendant_id?: string | null; arbitrators?: unknown },
  actorId: string,
): void {
  if (actorId === dispute.plaintiff_id || actorId === dispute.defendant_id) {
    throw new ForbiddenError('Dispute parties cannot manage appeals or escalation');
  }

  const arbitrators = Array.isArray(dispute.arbitrators)
    ? dispute.arbitrators.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : [];
  if (!arbitrators.includes(actorId)) {
    throw new ForbiddenError('Only assigned arbitrators can manage appeals or escalation');
  }
}

export async function fileAppeal(
  disputeId: string,
  appellantId: string,
  grounds: string,
  appealFee?: number,
  newEvidence?: unknown[],
): Promise<{ appeal_id: string; status: string }> {
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

  const appealId = `apl_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  const appeal = await runSerializableTransaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { dispute_id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute', disputeId);
    }

    if (appellantId !== dispute.plaintiff_id && appellantId !== dispute.defendant_id) {
      throw new ForbiddenError('Only dispute parties can file appeals');
    }

    const disputeStatus = dispute.status ?? 'filed';
    const isResolved = ['resolved', 'dismissed'].includes(disputeStatus);
    if (!isResolved) {
      throw new ConflictError(`Only resolved disputes can be appealed (current status: ${disputeStatus})`);
    }

    if (dispute.resolved_at) {
      const windowMs = APPEAL_CONDITIONS.appeal_window_days * 24 * 60 * 60 * 1000;
      const expired = Date.now() - dispute.resolved_at.getTime() > windowMs;
      if (expired) {
        throw new ConflictError('Appeal window has expired (7 days from ruling)');
      }
    }

    const minimumAppealFee = (dispute.filing_fee ?? 0) * APPEAL_CONDITIONS.appeal_fee_multiplier;
    const resolvedAppealFee = appealFee ?? minimumAppealFee;
    if (!Number.isInteger(resolvedAppealFee) || resolvedAppealFee < minimumAppealFee) {
      throw new ValidationError(`appeal_fee must be at least ${minimumAppealFee}`);
    }

    const existingAppeals = await tx.appeal.count({
      where: { original_dispute_id: disputeId },
    });

    if (existingAppeals >= APPEAL_CONDITIONS.max_appeals_per_dispute) {
      throw new ConflictError(
        `Maximum appeals (${APPEAL_CONDITIONS.max_appeals_per_dispute}) already filed for this dispute`,
      );
    }

    const appellantNode = await tx.node.findUnique({
      where: { node_id: appellantId },
      select: { credit_balance: true },
    });

    if (!appellantNode) {
      throw new NotFoundError('Node', appellantId);
    }

    const debited = await tx.node.updateMany({
      where: {
        node_id: appellantId,
        credit_balance: { gte: resolvedAppealFee },
      },
      data: { credit_balance: { decrement: resolvedAppealFee } },
    });

    if (debited.count !== 1) {
      throw new InsufficientCreditsError(resolvedAppealFee, appellantNode.credit_balance);
    }

    const updatedNode = await tx.node.findUnique({
      where: { node_id: appellantId },
      select: { credit_balance: true },
    });

    if (!updatedNode) {
      throw new NotFoundError('Node', appellantId);
    }

    await tx.creditTransaction.create({
      data: {
        node_id: appellantId,
        amount: -resolvedAppealFee,
        type: 'appeal_fee',
        description: `Appeal fee for dispute: ${disputeId}`,
        balance_after: updatedNode.credit_balance,
      },
    });

    return tx.appeal.create({
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
  });

  return { appeal_id: appeal.appeal_id, status: appeal.status };
}

export async function reviewAppeal(appealId: string, actorId: string): Promise<AppealResult> {
  return runSerializableTransaction(async (tx) => {
    const appeal = await tx.appeal.findUnique({
      where: { appeal_id: appealId },
    });

    if (!appeal) {
      throw new NotFoundError('Appeal', appealId);
    }

    const dispute = await tx.dispute.findUnique({
      where: { dispute_id: appeal.original_dispute_id },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute', appeal.original_dispute_id);
    }

    assertCanManageAppeal(dispute, actorId);

    if (appeal.status !== 'filed') {
      throw new ConflictError('Appeal has already been reviewed');
    }

    // Evaluate appeal merit based on new evidence quality
    const newEvidenceList = (appeal.new_evidence as unknown[]) ?? [];
    const hasSubstantialEvidence = newEvidenceList.length >= 2;

    // Appeal is accepted if there is substantial new evidence
    // and the grounds are non-trivial
    const accepted =
      hasSubstantialEvidence && appeal.grounds.length > 20;
    const nextStatus = accepted ? 'accepted' : 'rejected';

    const reviewed = await tx.appeal.updateMany({
      where: {
        appeal_id: appealId,
        status: 'filed',
      },
      data: { status: nextStatus },
    });

    if (reviewed.count !== 1) {
      throw new ConflictError('Appeal has already been reviewed');
    }

    if (accepted) {
      // Escalate to full Council review per APPEAL_CONDITIONS.full_council_review
      const councilSessionId = `cns_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

      const escalated = await tx.dispute.updateMany({
        where: {
          dispute_id: appeal.original_dispute_id,
          status: dispute.status,
        },
        data: {
          status: 'escalated',
          council_session_id: councilSessionId,
        },
      });

      if (escalated.count !== 1) {
        throw new ConflictError('Dispute state changed; retry');
      }

      return {
        appeal_id: appealId,
        status: 'accepted',
        accepted: true,
        reasoning:
          'New evidence substantiates the appeal. Case escalated to full Council review.',
        escalated: true,
        council_session_id: councilSessionId,
      };
    }

    return {
      appeal_id: appealId,
      status: 'rejected',
      accepted: false,
      reasoning:
        'Appeal lacks sufficient new evidence or compelling grounds. Appeal rejected.',
      escalated: false,
    };
  });
}

export async function processAppealDecision(appealId: string, actorId: string): Promise<void> {
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

  assertCanManageAppeal(dispute, actorId);

  if (appeal.status === 'accepted') {
    if (dispute.status !== 'escalated') {
      const blocked = await prisma.appeal.updateMany({
        where: {
          appeal_id: appealId,
          status: 'accepted',
        },
        data: { status: 'accepted_blocked' },
      });
      if (blocked.count !== 1) {
        throw new ConflictError('Appeal decision already processed');
      }
      throw new ConflictError('Appeal can only be processed while dispute is escalated');
    }

    const claimed = await prisma.appeal.updateMany({
      where: {
        appeal_id: appealId,
        status: 'accepted',
      },
      data: { status: 'accepted_processing' },
    });

    if (claimed.count !== 1) {
      throw new ConflictError('Appeal decision already processed');
    }

    // Re-select arbitrators with full Council participation
    const expectedCount = ARBITRATOR_COUNT[dispute.severity] ?? 3;
    const previousArbitrators = ((dispute.arbitrators as string[]) ?? []);
    const excludedArbitrators = [...new Set([actorId, ...previousArbitrators])];
    let added: string[] = [];
    let removed: string[] = [];
    let rollbackAcceptedClaim = true;
    let releaseAddedOnError = true;
    try {
      const newArbitrators = await selectAndReserveArbitrators(
        appeal.original_dispute_id,
        dispute.severity,
        previousArbitrators,
        excludedArbitrators,
      );
      ({ added, removed } = diffArbitratorAssignments(
        previousArbitrators,
        newArbitrators,
      ));
      if (newArbitrators.length !== expectedCount) {
        throw new ConflictError(
          `Need exactly ${expectedCount} eligible arbitrators, found ${newArbitrators.length}`,
        );
      }

      const outcome = await runSerializableTransaction(async (tx) => {
        const currentAppeal = await tx.appeal.findUnique({
          where: { appeal_id: appealId },
        });

        if (!currentAppeal) {
          throw new NotFoundError('Appeal', appealId);
        }

        if (currentAppeal.status !== 'accepted_processing') {
          throw new ConflictError('Appeal decision already processed');
        }

        const currentDispute = await tx.dispute.findUnique({
          where: { dispute_id: appeal.original_dispute_id },
        });

        if (!currentDispute) {
          throw new NotFoundError('Dispute', appeal.original_dispute_id);
        }

        assertCanManageAppeal(currentDispute, actorId);

        const reassigned = await tx.dispute.updateMany({
          where: {
            dispute_id: appeal.original_dispute_id,
            status: 'escalated',
          },
          data: {
            status: 'under_review',
            arbitrators: newArbitrators,
            review_started_at: new Date(),
            hearing_started_at: null,
            resolved_at: null,
            ruling: Prisma.DbNull,
            council_session_id: null,
          },
        });

        if (reassigned.count !== 1) {
          await tx.appeal.update({
            where: { appeal_id: appealId },
            data: { status: 'accepted_blocked' },
          });
          return { blocked: true };
        }

        await tx.appeal.update({
          where: { appeal_id: appealId },
          data: { status: 'accepted_processed' },
        });

        return { blocked: false };
      });

      if (outcome.blocked) {
        rollbackAcceptedClaim = false;
        throw new ConflictError('Dispute can no longer be reopened via appeal');
      }

      rollbackAcceptedClaim = false;
      releaseAddedOnError = false;
      await releaseArbitrators(removed);
      return;
    } catch (error) {
      if (releaseAddedOnError && added.length > 0) {
        await releaseArbitrators(added);
      }
      if (rollbackAcceptedClaim) {
        await prisma.appeal.updateMany({
          where: {
            appeal_id: appealId,
            status: 'accepted_processing',
          },
          data: { status: 'accepted' },
        });
      }
      throw error;
    }
  } else if (appeal.status === 'rejected') {
    const processed = await prisma.appeal.updateMany({
      where: {
        appeal_id: appealId,
        status: 'rejected',
      },
      data: { status: 'rejected_processed' },
    });

    if (processed.count !== 1) {
      throw new ConflictError('Appeal decision already processed');
    }

    return;
  } else if (
    appeal.status === 'accepted_processing'
    || appeal.status === 'accepted_processed'
    || appeal.status === 'rejected_processed'
  ) {
    throw new ConflictError('Appeal decision already processed');
  }

  throw new ConflictError(`Appeal decision cannot be processed from status: ${appeal.status}`);
}

export async function escalateToCouncil(
  disputeId: string,
  actorId: string,
): Promise<{ council_session_id: string }> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  assertCanManageAppeal(dispute, actorId);

  if (dispute.status === 'escalated') {
    throw new ConflictError('Dispute already escalated');
  }
  if (!COUNCIL_ESCALATION_SOURCE_STATUSES.has(dispute.status)) {
    throw new ConflictError('Cannot escalate a finalized dispute');
  }

  const councilSessionId = `cns_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  const escalated = await prisma.dispute.updateMany({
    where: {
      dispute_id: disputeId,
      status: { in: Array.from(COUNCIL_ESCALATION_SOURCE_STATUSES) },
    },
    data: {
      status: 'escalated',
      council_session_id: councilSessionId,
    },
  });

  if (escalated.count !== 1) {
    throw new ConflictError('Dispute state changed during escalation');
  }

  return { council_session_id: councilSessionId };
}

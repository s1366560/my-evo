import { PrismaClient, Prisma } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InsufficientCreditsError,
} from '../shared/errors';
import * as arbitratorPool from './arbitrator-pool';
import * as evidenceChain from './evidence-chain';
import * as autoRuling from './auto-ruling';
import * as appealModule from './appeal';
import {
  ARBITRATION_DEADLINE_DAYS,
  ARBITRATOR_CRITERIA,
  ARBITRATOR_COUNT,
  DEFENDANT_BAIL,
  FILING_FEES,
  type DisputeRuling,
  type DisputeSeverity,
  type DisputeStatus,
  type DisputeType,
  isEvidenceRecordList,
} from './types';

let prisma = new PrismaClient();

const DISPUTE_TYPES: readonly DisputeType[] = [
  'asset_quality',
  'transaction',
  'reputation_attack',
  'governance',
] as const;

const DISPUTE_STATUSES: readonly DisputeStatus[] = [
  'filed',
  'under_review',
  'hearing',
  'resolved',
  'dismissed',
  'escalated',
] as const;

const RULING_STATUSES: readonly DisputeStatus[] = [
  'under_review',
  'hearing',
  'resolved',
  'dismissed',
] as const;

const DISPUTE_LIST_SELECT = {
  dispute_id: true,
  type: true,
  severity: true,
  status: true,
  plaintiff_id: true,
  defendant_id: true,
  title: true,
  description: true,
  related_asset_id: true,
  related_bounty_id: true,
  related_transaction_id: true,
  arbitrators: true,
  filing_fee: true,
  escrow_amount: true,
  filed_at: true,
  review_started_at: true,
  hearing_started_at: true,
  resolved_at: true,
  deadline: true,
} as const;

const DISPUTE_DETAIL_SELECT = {
  ...DISPUTE_LIST_SELECT,
  evidence: true,
  ruling: true,
} as const;

const APPEAL_LIST_SELECT = {
  appeal_id: true,
  original_dispute_id: true,
  appellant_id: true,
  grounds: true,
  appeal_fee: true,
  status: true,
  filed_at: true,
  new_evidence: true,
} as const;

type DisputeListRecord = Prisma.DisputeGetPayload<{ select: typeof DISPUTE_LIST_SELECT }>;
type DisputeDetailRecord = Prisma.DisputeGetPayload<{ select: typeof DISPUTE_DETAIL_SELECT }>;
type AppealListRecord = Prisma.AppealGetPayload<{ select: typeof APPEAL_LIST_SELECT }>;

const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  filed: ['under_review', 'dismissed'],
  under_review: ['under_review', 'hearing', 'resolved', 'dismissed'],
  hearing: ['hearing', 'resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
  escalated: ['under_review'],
};

function isDisputeType(value: string): value is DisputeType {
  return DISPUTE_TYPES.includes(value as DisputeType);
}

function isDisputeStatus(value: string): value is DisputeStatus {
  return DISPUTE_STATUSES.includes(value as DisputeStatus);
}

function normalizeSeverity(value: string): DisputeSeverity {
  switch (value) {
    case 'low':
    case 'medium':
    case 'high':
    case 'critical':
      return value;
    default:
      return 'medium';
  }
}

function deriveSeverity(type: DisputeType): DisputeSeverity {
  switch (type) {
    case 'asset_quality':
      return 'medium';
    case 'transaction':
    case 'reputation_attack':
      return 'high';
    case 'governance':
      return 'critical';
  }
}

function validateTextField(
  field: 'title' | 'description',
  value: string,
  minLength: number,
  maxLength: number,
): void {
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new ValidationError(
      `${field} must be between ${minLength} and ${maxLength} characters`,
    );
  }
}

function normalizeArbitrators(arbitrators: string[]): string[] {
  const normalized = arbitrators
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return [...new Set(normalized)];
}

function validateStatusTransition(currentStatus: string, nextStatus: DisputeStatus): void {
  const normalizedCurrent = isDisputeStatus(currentStatus) ? currentStatus : 'filed';
  if (!DISPUTE_TRANSITIONS[normalizedCurrent].includes(nextStatus)) {
    throw new ConflictError(`Cannot move dispute from ${normalizedCurrent} to ${nextStatus}`);
  }
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

  throw new ConflictError('Dispute state changed; retry');
}

function getAssignedArbitrators(dispute: { arbitrators?: unknown }): string[] {
  if (!Array.isArray(dispute.arbitrators)) {
    return [];
  }

  return dispute.arbitrators.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

function assertCanAssignArbitrators(
  dispute: {
    plaintiff_id?: string | null;
    defendant_id?: string | null;
    status?: string | null;
    arbitrators?: unknown;
  },
  actorId: string,
): void {
  if (actorId === dispute.plaintiff_id || actorId === dispute.defendant_id) {
    throw new ForbiddenError('Dispute parties cannot assign arbitrators');
  }

  if (dispute.status === 'escalated') {
    throw new ConflictError('Escalated disputes must be reopened via appeal processing');
  }

  if (dispute.status === 'under_review' && getAssignedArbitrators(dispute).length > 0) {
    throw new ConflictError('Cannot change arbitrators after review has started');
  }
}

async function assertManualArbitratorsEligible(
  dispute: {
    plaintiff_id?: string | null;
    defendant_id?: string | null;
    arbitrators?: unknown;
  },
  arbitrators: string[],
  actorId: string,
): Promise<void> {
  if (arbitrators.includes(actorId)) {
    throw new ForbiddenError('Dispute managers cannot assign themselves as arbitrators');
  }

  if (
    arbitrators.includes(dispute.plaintiff_id ?? '')
    || arbitrators.includes(dispute.defendant_id ?? '')
  ) {
    throw new ForbiddenError('Dispute parties cannot be assigned as arbitrators');
  }

  const eligibleNodes = await prisma.node.findMany({
    where: {
      node_id: { in: arbitrators },
      status: 'registered',
      trust_level: 'trusted',
      reputation: { gte: ARBITRATOR_CRITERIA.min_reputation },
    },
    select: { node_id: true },
  });
  const eligibleIds = new Set(eligibleNodes.map((node) => node.node_id));
  const previousArbitrators = getAssignedArbitrators(dispute);

  for (const arbitratorId of arbitrators) {
    if (!eligibleIds.has(arbitratorId)) {
      throw new ValidationError(`Arbitrator ${arbitratorId} is not an eligible trusted arbitrator`);
    }

    if (
      !previousArbitrators.includes(arbitratorId)
      && arbitratorPool.getArbitratorWorkload(arbitratorId) >= ARBITRATOR_CRITERIA.max_active_disputes
    ) {
      throw new ConflictError(`Arbitrator ${arbitratorId} is at capacity`);
    }
  }
}

function assertAssignedArbitrator(
  dispute: { arbitrators?: unknown },
  actorId: string,
): void {
  if (!getAssignedArbitrators(dispute).includes(actorId)) {
    throw new ForbiddenError('Only assigned arbitrators can issue rulings');
  }
}

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
  arbitratorPool.setPrisma(client);
  evidenceChain.setPrisma(client);
  autoRuling.setPrisma(client);
  appealModule.setPrisma(client);
}

// Re-export sub-modules for convenience
export { arbitratorPool, evidenceChain, autoRuling, appealModule };

export interface DisputeViewer {
  node_id: string;
  trust_level?: string;
  auth_type?: string;
  scopes?: readonly string[];
}

function hasDisputeReadScope(viewer: DisputeViewer): boolean {
  if (viewer.auth_type !== 'api_key') {
    return true;
  }

  return viewer.scopes?.includes('read') === true
    || viewer.scopes?.includes('disputes:read') === true
    || viewer.scopes?.includes('disputes:read:any') === true;
}

function assertCanReadDisputes(viewer: DisputeViewer): void {
  if (!hasDisputeReadScope(viewer)) {
    throw new ForbiddenError('Missing required scope: disputes:read');
  }
}

function canViewAllDisputes(viewer: DisputeViewer): boolean {
  return viewer.scopes?.includes('disputes:read:any') === true;
}

function countJsonArrayItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function buildDisputeVisibilityWhere(viewer: DisputeViewer): Record<string, unknown> {
  if (canViewAllDisputes(viewer)) {
    return {};
  }

  return {
    OR: [
      { plaintiff_id: viewer.node_id },
      { defendant_id: viewer.node_id },
      { arbitrators: { has: viewer.node_id } },
    ],
  };
}

function assertCanViewDispute(
  dispute: {
    plaintiff_id?: string | null;
    defendant_id?: string | null;
    arbitrators?: unknown;
  },
  viewer: DisputeViewer,
): void {
  if (canViewAllDisputes(viewer)) {
    return;
  }

  const assignedArbitrators = getAssignedArbitrators(dispute);
  if (
    viewer.node_id !== dispute.plaintiff_id
    && viewer.node_id !== dispute.defendant_id
    && !assignedArbitrators.includes(viewer.node_id)
  ) {
    throw new ForbiddenError('Cannot access this dispute');
  }
}

function toDisputeDetail(dispute: DisputeDetailRecord): Omit<DisputeDetailRecord, 'evidence'> & {
  evidence_count: number;
} {
  const { evidence, ...rest } = dispute;
  return {
    ...rest,
    evidence_count: countJsonArrayItems(evidence),
  };
}

function toCreatedDisputeResponse(dispute: {
  dispute_id: string;
  type: string;
  severity: string;
  status: string;
  plaintiff_id: string;
  defendant_id: string;
  title: string;
  description: string;
  related_asset_id?: string | null;
  related_bounty_id?: string | null;
  related_transaction_id?: string | null;
  arbitrators?: unknown;
  filing_fee: number;
  escrow_amount: number;
  filed_at: Date;
  review_started_at?: Date | null;
  hearing_started_at?: Date | null;
  resolved_at?: Date | null;
  deadline: Date;
  evidence?: unknown;
  ruling?: unknown;
}) {
  return {
    dispute_id: dispute.dispute_id,
    type: dispute.type,
    severity: dispute.severity,
    status: dispute.status,
    plaintiff_id: dispute.plaintiff_id,
    defendant_id: dispute.defendant_id,
    title: dispute.title,
    description: dispute.description,
    related_asset_id: dispute.related_asset_id ?? null,
    related_bounty_id: dispute.related_bounty_id ?? null,
    related_transaction_id: dispute.related_transaction_id ?? null,
    arbitrators: getAssignedArbitrators(dispute),
    filing_fee: dispute.filing_fee,
    escrow_amount: dispute.escrow_amount,
    filed_at: dispute.filed_at,
    review_started_at: dispute.review_started_at ?? null,
    hearing_started_at: dispute.hearing_started_at ?? null,
    resolved_at: dispute.resolved_at ?? null,
    deadline: dispute.deadline,
    ruling: dispute.ruling ?? null,
    evidence_count: countJsonArrayItems(dispute.evidence),
  };
}

function toDisputeMutationResponse(dispute: {
  dispute_id: string;
  status: string;
  arbitrators?: unknown;
  review_started_at?: Date | null;
  hearing_started_at?: Date | null;
  resolved_at?: Date | null;
  ruling?: unknown;
}) {
  return {
    dispute_id: dispute.dispute_id,
    status: dispute.status,
    arbitrators: getAssignedArbitrators(dispute),
    review_started_at: dispute.review_started_at ?? null,
    hearing_started_at: dispute.hearing_started_at ?? null,
    resolved_at: dispute.resolved_at ?? null,
    ruling: dispute.ruling ?? null,
  };
}

function toAppealSummary(appeal: AppealListRecord): Omit<AppealListRecord, 'new_evidence'> & {
  new_evidence_count: number;
} {
  const { new_evidence, ...rest } = appeal;
  return {
    ...rest,
    new_evidence_count: countJsonArrayItems(new_evidence),
  };
}

// ─── Dispute CRUD ─────────────────────────────────────────────────────────────

export async function listDisputes(
  viewer: DisputeViewer,
  status?: string,
  type?: string,
  limit = 20,
  offset = 0,
) {
  assertCanReadDisputes(viewer);
  const where: Record<string, unknown> = buildDisputeVisibilityWhere(viewer);
  if (status) where.status = status;
  if (type) where.type = type;

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      select: DISPUTE_LIST_SELECT,
      orderBy: { filed_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.dispute.count({ where }),
  ]);

  return { items, total };
}

export async function getDispute(disputeId: string, viewer: DisputeViewer) {
  assertCanReadDisputes(viewer);
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
    select: DISPUTE_DETAIL_SELECT,
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  assertCanViewDispute(dispute, viewer);

  return toDisputeDetail(dispute);
}

export async function fileDispute(
  plaintiffId: string,
  data: {
    type: string;
    defendant_id: string;
    title: string;
    description: string;
    evidence?: unknown[];
    related_asset_id?: string;
    related_bounty_id?: string;
    related_transaction_id?: string;
    filing_fee?: number;
  },
) {
  if (!isDisputeType(data.type)) {
    throw new ValidationError(
      `type must be one of ${DISPUTE_TYPES.join(', ')}`,
    );
  }

  if (plaintiffId === data.defendant_id) {
    throw new ValidationError('plaintiff_id and defendant_id must be different');
  }

  if (data.evidence !== undefined && !isEvidenceRecordList(data.evidence)) {
    throw new ValidationError('evidence must be an array of valid evidence objects');
  }

  validateTextField('title', data.title, 5, 200);
  validateTextField('description', data.description, 10, 5000);

  const disputeId = `dsp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date();
  const severity = deriveSeverity(data.type);
  const filingFee = FILING_FEES[severity] ?? 25;
  const escrowAmount = DEFENDANT_BAIL[severity] ?? 50;
  const arbitrationDeadlineDays = ARBITRATION_DEADLINE_DAYS[severity] ?? 5;
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + arbitrationDeadlineDays);

  const dispute = await runSerializableTransaction(async (tx) => {
    const [plaintiffNode, defendantNode] = await Promise.all([
      tx.node.findUnique({
        where: { node_id: plaintiffId },
        select: { credit_balance: true },
      }),
      tx.node.findUnique({
        where: { node_id: data.defendant_id },
        select: { node_id: true },
      }),
    ]);

    if (!plaintiffNode) {
      throw new NotFoundError('Node', plaintiffId);
    }

    if (!defendantNode) {
      throw new NotFoundError('Node', data.defendant_id);
    }

    if (data.type === 'asset_quality') {
      if (!data.related_asset_id) {
        throw new ValidationError('related_asset_id is required for asset_quality disputes');
      }

      const asset = await tx.asset.findUnique({
        where: { asset_id: data.related_asset_id },
        select: { author_id: true },
      });

      if (!asset) {
        throw new NotFoundError('Asset', data.related_asset_id);
      }

      if (asset.author_id !== data.defendant_id) {
        throw new ValidationError('defendant_id must match the asset author');
      }
    }

    if (plaintiffNode.credit_balance < filingFee) {
      throw new InsufficientCreditsError(filingFee, plaintiffNode.credit_balance);
    }

    const updatedPlaintiff = await tx.node.update({
      where: { node_id: plaintiffId },
      data: {
        credit_balance: { decrement: filingFee },
      },
      select: { credit_balance: true },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: plaintiffId,
        amount: -filingFee,
        type: 'dispute_filing_fee',
        description: `Filing fee for dispute: ${data.title}`,
        balance_after: updatedPlaintiff.credit_balance,
      },
    });

    return tx.dispute.create({
      data: {
        dispute_id: disputeId,
        type: data.type,
        plaintiff_id: plaintiffId,
        defendant_id: data.defendant_id,
        title: data.title,
        description: data.description,
        evidence: (data.evidence ?? []) as object[],
        related_asset_id: data.related_asset_id,
        related_bounty_id: data.related_bounty_id,
        related_transaction_id: data.related_transaction_id,
        target_id: data.type === 'asset_quality' ? data.related_asset_id : undefined,
        filing_fee: filingFee,
        escrow_amount: escrowAmount,
        status: 'filed',
        severity,
        arbitrators: [],
        deadline,
        filed_at: now,
      },
    });
  });

  return toCreatedDisputeResponse(dispute);
}

// ─── Arbitration ───────────────────────────────────────────────────────────────

export async function selectAndAssignArbitrators(
  disputeId: string,
  actorId: string,
): Promise<string[]> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  assertCanAssignArbitrators(dispute, actorId);
  validateStatusTransition(dispute.status, 'under_review');

  const severity = normalizeSeverity(dispute.severity);
  const expectedCount = ARBITRATOR_COUNT[severity] ?? 3;
  const previousArbitrators = ((dispute.arbitrators as string[]) ?? []);
  const selected = await arbitratorPool.selectAndReserveArbitrators(
    disputeId,
    severity,
    previousArbitrators,
    [actorId],
  );
  const { added, removed } = arbitratorPool.diffArbitratorAssignments(
    previousArbitrators,
    selected,
  );

  if (selected.length !== expectedCount) {
    await arbitratorPool.releaseArbitrators(added);
    throw new ConflictError(
      `Need exactly ${expectedCount} eligible arbitrators, found ${selected.length}`,
    );
  }

  try {
    const persisted = await prisma.dispute.updateMany({
      where: {
        dispute_id: disputeId,
        status: dispute.status,
        arbitrators: { equals: previousArbitrators },
      },
      data: {
        arbitrators: selected,
        status: 'under_review',
        review_started_at: new Date(),
        hearing_started_at: null,
        resolved_at: null,
        ruling: Prisma.DbNull,
        council_session_id: null,
      },
    });

    if (persisted.count !== 1) {
      throw new ConflictError('Dispute state changed during arbitrator assignment');
    }
  } catch (error) {
    await arbitratorPool.releaseArbitrators(added);
    throw error;
  }
  await arbitratorPool.releaseArbitrators(removed);

  return selected;
}

export async function assignArbitrators(disputeId: string, arbitrators: string[], actorId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  assertCanAssignArbitrators(dispute, actorId);
  validateStatusTransition(dispute.status, 'under_review');

  const normalized = normalizeArbitrators(arbitrators);
  const severity = normalizeSeverity(dispute.severity);
  const expectedCount = ARBITRATOR_COUNT[severity] ?? 3;

  if (normalized.length !== expectedCount) {
    throw new ValidationError(
      `${severity} severity disputes require exactly ${expectedCount} arbitrators`,
    );
  }

  await assertManualArbitratorsEligible(dispute, normalized, actorId);

  const now = new Date();
  const previousArbitrators = getAssignedArbitrators(dispute);
  const { added, removed } = arbitratorPool.diffArbitratorAssignments(previousArbitrators, normalized);
  let reserved = false;

  try {
    await arbitratorPool.withSelectionLock(async () => {
      await assertManualArbitratorsEligible(dispute, normalized, actorId);
      arbitratorPool.reserveArbitrators(added);
      reserved = true;

      const persisted = await prisma.dispute.updateMany({
        where: {
          dispute_id: disputeId,
          status: dispute.status,
          arbitrators: { equals: previousArbitrators },
        },
        data: {
          arbitrators: normalized,
          status: 'under_review',
          review_started_at: now,
          hearing_started_at: null,
          resolved_at: null,
          ruling: Prisma.DbNull,
          council_session_id: null,
        },
      });

      if (persisted.count !== 1) {
        throw new ConflictError('Dispute state changed during arbitrator assignment');
      }
    });
  } catch (error) {
    if (reserved && added.length > 0) {
      await arbitratorPool.releaseArbitrators(added);
    }
    throw error;
  }

  await arbitratorPool.releaseArbitrators(removed);

  return toDisputeMutationResponse({
    dispute_id: dispute.dispute_id,
    status: 'under_review',
    arbitrators: normalized,
    review_started_at: now,
    hearing_started_at: null,
    resolved_at: null,
    ruling: null,
  });
}

export async function issueRuling(
  disputeId: string,
  ruling: object,
  status: string,
  actorId: string,
) {
  if (!ruling || typeof ruling !== 'object' || Array.isArray(ruling)) {
    throw new ValidationError('ruling must be an object');
  }

  if (!RULING_STATUSES.includes(status as DisputeStatus)) {
    throw new ValidationError(
      `status must be one of ${RULING_STATUSES.join(', ')}`,
    );
  }
  const nextStatus = status as DisputeStatus;

  const { updated, releasedArbitrators } = await runSerializableTransaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { dispute_id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundError('Dispute', disputeId);
    }

    if (dispute.status === 'escalated') {
      throw new ConflictError('Escalated disputes must be reopened via appeal processing');
    }

    assertAssignedArbitrator(dispute, actorId);
    validateStatusTransition(dispute.status, nextStatus);

    const now = new Date();
    const resolvedAt =
      nextStatus === 'resolved' || nextStatus === 'dismissed'
        ? now
        : dispute.resolved_at;
    const reviewStartedAt =
      nextStatus === 'under_review' ? dispute.review_started_at ?? now : dispute.review_started_at;
    const hearingStartedAt =
      nextStatus === 'hearing' || nextStatus === 'resolved' || nextStatus === 'dismissed'
        ? dispute.hearing_started_at ?? now
        : dispute.hearing_started_at;

    const updated = await tx.dispute.update({
      where: { dispute_id: disputeId },
      data: {
        ruling: ruling as object,
        status: nextStatus,
        resolved_at: resolvedAt,
        review_started_at: reviewStartedAt,
        hearing_started_at: hearingStartedAt,
      },
    });

    return {
      updated,
      releasedArbitrators:
        nextStatus === 'resolved' || nextStatus === 'dismissed'
          ? getAssignedArbitrators(dispute)
          : [],
    };
  });

  if (releasedArbitrators.length > 0) {
    await arbitratorPool.releaseArbitrators(releasedArbitrators);
  }

  return toDisputeMutationResponse(updated);
}

export async function autoGenerateRuling(disputeId: string, actorId: string): Promise<DisputeRuling> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  assertAssignedArbitrator(dispute, actorId);
  validateStatusTransition(dispute.status, 'resolved');

  const ruling = await autoRuling.generateRuling(disputeId);
  await issueRuling(disputeId, ruling as object, 'resolved', actorId);

  return ruling;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

export async function validateEvidence(evidenceId: string) {
  return evidenceChain.validateEvidenceIntegrity(evidenceId);
}

export async function scoreEvidence(disputeId: string) {
  return evidenceChain.calculateEvidenceScore(disputeId);
}

export async function detectEvidenceTampering(evidenceId: string) {
  const dispute = await prisma.dispute.findFirst({
    where: {
      evidence: { equals: undefined, not: JSON.stringify([]) },
    },
    orderBy: { filed_at: 'desc' },
  });

  if (!dispute) {
    throw new NotFoundError('Evidence', evidenceId);
  }

  const evidenceList = ((dispute.evidence as unknown) as evidenceChain.EvidenceWithMeta[]) ?? [];
  const evidence = evidenceList.find((e) => e.evidence_id === evidenceId);

  if (!evidence) {
    throw new NotFoundError('Evidence', evidenceId);
  }

  return evidenceChain.detectTampering(evidence);
}

// ─── Appeals ───────────────────────────────────────────────────────────────────

export async function fileAppeal(
  originalDisputeId: string,
  appellantId: string,
  grounds: string,
  appealFee?: number,
  newEvidence?: unknown[],
) {
  return appealModule.fileAppeal(
    originalDisputeId,
    appellantId,
    grounds,
    appealFee,
    newEvidence,
  );
}

export async function listAppeals(disputeId: string, viewer: DisputeViewer) {
  const dispute = await getDispute(disputeId, viewer);
  const appeals = await prisma.appeal.findMany({
    where: { original_dispute_id: dispute.dispute_id },
    select: APPEAL_LIST_SELECT,
    orderBy: { filed_at: 'desc' },
  });

  return appeals.map(toAppealSummary);
}

export async function reviewAppeal(appealId: string, actorId: string) {
  return appealModule.reviewAppeal(appealId, actorId);
}

export async function processAppealDecision(appealId: string, actorId: string) {
  return appealModule.processAppealDecision(appealId, actorId);
}

export async function escalateDisputeToCouncil(disputeId: string, actorId: string) {
  return appealModule.escalateToCouncil(disputeId, actorId);
}

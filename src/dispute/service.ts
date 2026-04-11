import { PrismaClient } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors';
import * as arbitratorPool from './arbitrator-pool';
import * as evidenceChain from './evidence-chain';
import * as autoRuling from './auto-ruling';
import * as appealModule from './appeal';
import {
  ARBITRATION_DEADLINE_DAYS,
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

const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  filed: ['under_review', 'dismissed', 'escalated'],
  under_review: ['under_review', 'hearing', 'resolved', 'dismissed', 'escalated'],
  hearing: ['hearing', 'resolved', 'dismissed', 'escalated'],
  resolved: ['escalated'],
  dismissed: ['escalated'],
  escalated: ['under_review', 'hearing', 'resolved', 'dismissed'],
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

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
  arbitratorPool.setPrisma(client);
  evidenceChain.setPrisma(client);
  autoRuling.setPrisma(client);
  appealModule.setPrisma(client);
}

// Re-export sub-modules for convenience
export { arbitratorPool, evidenceChain, autoRuling, appealModule };

// ─── Dispute CRUD ─────────────────────────────────────────────────────────────

export async function listDisputes(
  status?: string,
  type?: string,
  limit = 20,
  offset = 0,
) {
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const [items, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      orderBy: { filed_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.dispute.count({ where }),
  ]);

  return { items, total };
}

export async function getDispute(disputeId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  return dispute;
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

  const dispute = await prisma.dispute.create({
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
      filing_fee: filingFee,
      escrow_amount: escrowAmount,
      status: 'filed',
      severity,
      arbitrators: [],
      deadline,
      filed_at: now,
    },
  });

  return dispute;
}

// ─── Arbitration ───────────────────────────────────────────────────────────────

export async function selectAndAssignArbitrators(
  disputeId: string,
): Promise<string[]> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  validateStatusTransition(dispute.status, 'under_review');

  const severity = normalizeSeverity(dispute.severity);
  const expectedCount = ARBITRATOR_COUNT[severity] ?? 3;
  const previousArbitrators = ((dispute.arbitrators as string[]) ?? []);
  const selected = await arbitratorPool.selectAndReserveArbitrators(
    disputeId,
    severity,
    previousArbitrators,
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
    await prisma.dispute.update({
      where: { dispute_id: disputeId },
      data: {
        arbitrators: selected,
        status: 'under_review',
        review_started_at: new Date(),
      },
    });
  } catch (error) {
    await arbitratorPool.releaseArbitrators(added);
    throw error;
  }
  await arbitratorPool.releaseArbitrators(removed);

  return selected;
}

export async function assignArbitrators(disputeId: string, arbitrators: string[]) {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  validateStatusTransition(dispute.status, 'under_review');

  const normalized = normalizeArbitrators(arbitrators);
  const severity = normalizeSeverity(dispute.severity);
  const expectedCount = ARBITRATOR_COUNT[severity] ?? 3;

  if (normalized.length !== expectedCount) {
    throw new ValidationError(
      `${severity} severity disputes require exactly ${expectedCount} arbitrators`,
    );
  }

  const now = new Date();

  const updated = await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      arbitrators: normalized,
      status: 'under_review',
      review_started_at: now,
    },
  });
  arbitratorPool.reconcileArbitratorWorkload(
    ((dispute.arbitrators as string[]) ?? []),
    normalized,
  );

  return updated;
}

export async function issueRuling(
  disputeId: string,
  ruling: object,
  status: string,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  if (!ruling || typeof ruling !== 'object' || Array.isArray(ruling)) {
    throw new ValidationError('ruling must be an object');
  }

  if (!isDisputeStatus(status) || status === 'filed') {
    throw new ValidationError(
      `status must be one of ${DISPUTE_STATUSES.filter((value) => value !== 'filed').join(', ')}`,
    );
  }

  validateStatusTransition(dispute.status, status);

  const now = new Date();
  const resolvedAt =
    status === 'resolved' || status === 'dismissed'
      ? dispute.resolved_at ?? now
      : dispute.resolved_at;
  const reviewStartedAt =
    status === 'under_review' ? dispute.review_started_at ?? now : dispute.review_started_at;
  const hearingStartedAt =
    status === 'hearing' || status === 'resolved' || status === 'dismissed'
      ? dispute.hearing_started_at ?? now
      : dispute.hearing_started_at;

  const updated = await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      ruling: ruling as object,
      status,
      resolved_at: resolvedAt,
      review_started_at: reviewStartedAt,
      hearing_started_at: hearingStartedAt,
    },
  });

  return updated;
}

export async function autoGenerateRuling(disputeId: string): Promise<DisputeRuling> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  const ruling = await autoRuling.generateRuling(disputeId);

  const now = new Date();
  await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      ruling: ruling as object,
      status: 'resolved',
      resolved_at: now,
      hearing_started_at: dispute.hearing_started_at ?? now,
    },
  });

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

export async function listAppeals(disputeId: string) {
  const appeals = await prisma.appeal.findMany({
    where: { original_dispute_id: disputeId },
    orderBy: { filed_at: 'desc' },
  });

  return appeals;
}

export async function reviewAppeal(appealId: string) {
  return appealModule.reviewAppeal(appealId);
}

export async function processAppealDecision(appealId: string) {
  return appealModule.processAppealDecision(appealId);
}

export async function escalateDisputeToCouncil(disputeId: string) {
  return appealModule.escalateToCouncil(disputeId);
}

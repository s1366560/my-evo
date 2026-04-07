import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../shared/errors';
import * as arbitratorPool from './arbitrator-pool';
import * as evidenceChain from './evidence-chain';
import * as autoRuling from './auto-ruling';
import * as appealModule from './appeal';
import type { DisputeRuling } from './types';

let prisma = new PrismaClient();

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
    filing_fee?: number;
  },
) {
  const disputeId = `dsp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + 30);

  const severity = data.related_asset_id ? 'medium' : 'low';

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
      filing_fee: data.filing_fee ?? 50,
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

  const selected = await arbitratorPool.selectArbitrator(disputeId, dispute.severity);

  await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      arbitrators: selected,
      status: 'under_review',
      review_started_at: new Date(),
    },
  });

  return selected;
}

export async function assignArbitrators(disputeId: string, arbitrators: string[]) {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  const now = new Date();

  const updated = await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      arbitrators,
      status: 'review',
      review_started_at: now,
    },
  });

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

  const now = new Date();
  const resolvedAt = status === 'resolved' ? now : null;

  const updated = await prisma.dispute.update({
    where: { dispute_id: disputeId },
    data: {
      ruling: ruling as object,
      status,
      resolved_at: resolvedAt,
      hearing_started_at: dispute.hearing_started_at ?? now,
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
  appealFee: number,
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

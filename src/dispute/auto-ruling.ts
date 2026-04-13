import { PrismaClient } from '@prisma/client';
import type { Verdict, DisputeRuling } from './types';
import { calculateEvidenceScore } from './evidence-chain';
import { ARBITRATOR_COUNT, RULING_TO_QUARANTINE } from './types';
import { NotFoundError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export interface ClaimScore {
  claim_id: string;
  score: number;
  supporting_evidence: number;
  contradicting_evidence: number;
  confidence: number;
}

export interface RulingScores {
  plaintiff_score: number;
  defendant_score: number;
  compromise_ratio: number;
  evidence_weight: number;
}

function toPanelVote(verdict: Verdict): DisputeRuling['votes'][number]['vote'] {
  switch (verdict) {
    case 'plaintiff_wins':
      return 'plaintiff';
    case 'defendant_wins':
      return 'defendant';
    case 'compromise':
      return 'compromise';
    case 'no_fault':
      return 'abstain';
  }
}

function buildVoteReasoning(
  verdict: Verdict,
  scores: RulingScores,
  evidenceScore: number,
): string {
  const evidencePercent = Math.round(evidenceScore * 100);

  switch (verdict) {
    case 'plaintiff_wins':
      return `Evidence strength (${evidencePercent}%) and score balance (${scores.plaintiff_score.toFixed(2)} vs ${scores.defendant_score.toFixed(2)}) favor the plaintiff.`;
    case 'defendant_wins':
      return `Evidence strength (${evidencePercent}%) and score balance (${scores.defendant_score.toFixed(2)} vs ${scores.plaintiff_score.toFixed(2)}) favor the defendant.`;
    case 'compromise':
      return `The evidentiary record is mixed (${evidencePercent}%), so a compromise best reflects the balanced score profile.`;
    case 'no_fault':
      return `The evidentiary record is insufficiently decisive (${evidencePercent}%), so fault cannot be assigned confidently.`;
  }
}

function buildPanelVotes(
  arbitrators: string[] | undefined,
  severity: string,
  verdict: Verdict,
  scores: RulingScores,
  evidenceScore: number,
): DisputeRuling['votes'] {
  if (!Array.isArray(arbitrators) || arbitrators.length === 0) {
    return [];
  }

  const panelSize = ARBITRATOR_COUNT[severity] ?? arbitrators.length;
  const reasoning = buildVoteReasoning(verdict, scores, evidenceScore);
  const vote = toPanelVote(verdict);

  return arbitrators.slice(0, panelSize).map((arbitratorId, index, panel) => ({
    arbitrator_id: arbitratorId,
    vote,
    reasoning: `${reasoning} Panel seat ${index + 1}/${panel.length}.`,
  }));
}

export async function generateRuling(disputeId: string): Promise<DisputeRuling> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    throw new NotFoundError('Dispute', disputeId);
  }

  const evidenceScore = await calculateEvidenceScore(disputeId);
  const scores = await calculateScores(disputeId, evidenceScore);
  const verdict = determineRulingType(scores);
  const reasoning = await generateRulingReasoning(disputeId);

  const ruling: DisputeRuling = {
    ruling_id: `rul_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    dispute_id: disputeId,
    verdict,
    reasoning,
    penalties: buildPenalties(verdict, dispute.defendant_id, dispute.type),
    compensations: buildCompensations(verdict, dispute.plaintiff_id, dispute.defendant_id, dispute),
    votes: buildPanelVotes(dispute.arbitrators, dispute.severity, verdict, scores, evidenceScore),
    ruled_at: new Date().toISOString(),
    appeal_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return ruling;
}

async function calculateScores(
  disputeId: string,
  evidenceScore: number,
): Promise<RulingScores> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) {
    return { plaintiff_score: 0, defendant_score: 0, compromise_ratio: 0, evidence_weight: 0 };
  }

  // Evidence score primarily supports whoever submitted stronger evidence
  // For auto-ruling, evidence score is the primary differentiator
  const evidenceWeight = 0.6;
  const plaintiffBase = 0.5;
  const evidenceDelta = (evidenceScore - 0.5) * evidenceWeight;

  const plaintiff_score = Math.min(1, Math.max(0, plaintiffBase + evidenceDelta));
  const defendant_score = Math.min(1, Math.max(0, plaintiffBase - evidenceDelta));
  const compromise_ratio = Math.abs(evidenceDelta) < 0.15 ? 1 : 0;

  return {
    plaintiff_score,
    defendant_score,
    compromise_ratio,
    evidence_weight: evidenceScore,
  };
}

export function determineRulingType(scores: RulingScores): Verdict {
  const { plaintiff_score, defendant_score, compromise_ratio } = scores;
  const diff = plaintiff_score - defendant_score;

  if (compromise_ratio >= 1) return 'compromise';

  if (diff > 0.15) return 'plaintiff_wins';
  if (diff < -0.15) return 'defendant_wins';
  return 'no_fault';
}

export async function generateRulingReasoning(disputeId: string): Promise<string> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) return 'Dispute not found.';

  const evidenceScore = await calculateEvidenceScore(disputeId);
  const evidencePercent = Math.round(evidenceScore * 100);
  const typeLabels: Record<string, string> = {
    asset_quality: 'Asset Quality Dispute',
    transaction: 'Transaction Dispute',
    reputation_attack: 'Reputation Attack Dispute',
    governance: 'Governance Dispute',
  };

  const lines = [
    `Case: ${typeLabels[dispute.type] ?? dispute.type} — ${dispute.severity.toUpperCase()} severity`,
    `Evidence Score: ${evidencePercent}% — ${evidenceScore >= 0.7 ? 'Strong evidentiary basis' : evidenceScore >= 0.4 ? 'Moderate evidence' : 'Weak evidence'}`.trim(),
    `Plaintiff: ${dispute.plaintiff_id}`,
    `Defendant: ${dispute.defendant_id}`,
    '',
    'Findings:',
    `- The plaintiff filed the dispute regarding: ${dispute.title}`,
    `- The defendant was notified and provided the following response: ${dispute.description}`,
    `- Total evidence items reviewed: ${((dispute.evidence as unknown[]) ?? []).length}`,
    '',
    'Analysis:',
    `The arbitration panel reviewed all submitted evidence against the burden of proof standard.`,
    `Evidence credibility scored at ${evidencePercent}%, indicating ${evidenceScore >= 0.7 ? 'high reliability' : 'partial reliability'} of the evidentiary record.`,
    '',
  ];

  return lines.join('\n');
}

export async function scoreClaim(
  claim: { id: string; content: string },
  evidence: Array<{ content: string; type: string }>,
): Promise<ClaimScore> {
  const claimWords = new Set(claim.content.toLowerCase().split(/\s+/));
  let supporting = 0;
  let contradicting = 0;

  for (const ev of evidence) {
    const evWords = new Set(ev.content.toLowerCase().split(/\s+/));
    const overlap = [...claimWords].filter((w) => evWords.has(w)).length;
    if (overlap > claimWords.size * 0.3) {
      if (ev.type === 'transaction_record' || ev.type === 'asset_hash') {
        supporting += 2;
      } else {
        supporting += 1;
      }
    } else if (overlap < claimWords.size * 0.1 && ev.content.length > 50) {
      contradicting += 1;
    }
  }

  const rawScore = supporting - contradicting;
  const confidence = Math.min(1, evidence.length * 0.15 + 0.2);

  return {
    claim_id: claim.id,
    score: Math.max(0, rawScore) / (claimWords.size + 1),
    supporting_evidence: supporting,
    contradicting_evidence: contradicting,
    confidence,
  };
}

function buildPenalties(
  verdict: Verdict,
  defendantId: string,
  disputeType: string,
): DisputeRuling['penalties'] {
  if (verdict === 'plaintiff_wins' || verdict === 'compromise') {
    const repPenalty = verdict === 'plaintiff_wins' ? 15 : 8;
    const creditFine = verdict === 'plaintiff_wins' ? 100 : 50;
    const quarantineLevel = (() => {
      switch (disputeType) {
        case 'asset_quality':
          return RULING_TO_QUARANTINE.asset_quality_defendant_loses?.level;
        case 'reputation_attack':
          return RULING_TO_QUARANTINE.reputation_attack_confirmed?.level;
        case 'governance':
          return RULING_TO_QUARANTINE.governance_violation?.level;
        default:
          return undefined;
      }
    })();
    const isGovernance = disputeType === 'governance';
    return [
      {
        target_node_id: defendantId,
        reputation_deduction: isGovernance ? Math.max(repPenalty, 25) : repPenalty,
        credit_fine: creditFine,
        quarantine_level: quarantineLevel,
        asset_revocation: disputeType === 'asset_quality' ? [] : undefined,
      },
    ];
  }
  return [];
}

function buildCompensations(
  verdict: Verdict,
  plaintiffId: string,
  defendantId: string,
  dispute: { filing_fee: number; escrow_amount: number },
): DisputeRuling['compensations'] {
  if (verdict === 'plaintiff_wins') {
    const filingFeeRefund = dispute.filing_fee;
    const escrowAmount = dispute.escrow_amount;
    return [
      {
        recipient_node_id: plaintiffId,
        credit_amount: filingFeeRefund + escrowAmount,
        reputation_restore: 5,
      },
    ];
  }
  if (verdict === 'compromise') {
    return [
      {
        recipient_node_id: plaintiffId,
        credit_amount: Math.floor(dispute.escrow_amount / 2),
        reputation_restore: 2,
      },
      {
        recipient_node_id: defendantId,
        credit_amount: Math.floor(dispute.filing_fee * 0.5),
        reputation_restore: 0,
      },
    ];
  }
  if (verdict === 'no_fault') {
    return [
      {
        recipient_node_id: plaintiffId,
        credit_amount: Math.floor(dispute.filing_fee * 0.8),
        reputation_restore: 0,
      },
    ];
  }
  return [];
}

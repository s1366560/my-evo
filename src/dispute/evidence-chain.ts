import { PrismaClient } from '@prisma/client';
import type {
  Evidence,
  EvidenceValidationResult,
  EvidenceType,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export interface EvidenceWithMeta extends Evidence {
  dispute_id?: string;
}

// SHA-256 simulation: in production use crypto.subtle.digest
async function computeHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  // Use Web Crypto API via node crypto for real hash
  // Here we simulate with a deterministic hash-like string
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(16, '0');
  return `sha256:${hex}${'0'.repeat(48 - hex.length)}`;
}

export async function validateEvidenceIntegrity(
  evidenceId: string,
): Promise<EvidenceValidationResult> {
  const dispute = await prisma.dispute.findFirst({
    where: {
      evidence: { equals: undefined, not: JSON.stringify([]) },
    },
    orderBy: { filed_at: 'desc' },
  });

  if (!dispute) {
    return {
      valid: false,
      tampered: false,
      score: 0,
      issues: ['Evidence record not found'],
    };
  }

  const evidenceList = ((dispute.evidence as unknown) as EvidenceWithMeta[]) ?? [];
  const evidence = evidenceList.find((e) => e.evidence_id === evidenceId);

  if (!evidence) {
    return {
      valid: false,
      tampered: false,
      score: 0,
      issues: ['Evidence not found in dispute record'],
    };
  }

  const expectedHash = await computeHash(evidence.content);
  const isValid = expectedHash === evidence.hash || evidence.verified;

  if (!isValid) {
    return {
      valid: false,
      tampered: true,
      score: 0,
      issues: ['Hash mismatch: evidence content does not match stored hash'],
    };
  }

  const score = evidence.verified ? 1.0 : 0.7;
  return {
    valid: true,
    tampered: false,
    score,
    issues: evidence.verified ? [] : ['Evidence hash not verified via crypto API'],
  };
}

export async function validateTemporalOrder(
  evidenceIds: string[],
): Promise<{ valid: boolean; issues: string[] }> {
  if (evidenceIds.length < 2) {
    return { valid: true, issues: [] };
  }

  const disputes = await prisma.dispute.findMany({
    where: { evidence: { equals: undefined, not: JSON.stringify([]) } },
    orderBy: { filed_at: 'asc' },
  });

  // Collect all evidence with timestamps
  const evidenceMap = new Map<string, { submitted_at: string; evidence_id: string }>();
  for (const dispute of disputes) {
    const evidenceList = ((dispute.evidence as unknown) as EvidenceWithMeta[]) ?? [];
    for (const ev of evidenceList) {
      evidenceMap.set(ev.evidence_id, {
        submitted_at: ev.submitted_at,
        evidence_id: ev.evidence_id,
      });
    }
  }

  const issues: string[] = [];

  for (let i = 0; i < evidenceIds.length - 1; i++) {
    const current = evidenceMap.get(evidenceIds[i]!);
    const next = evidenceMap.get(evidenceIds[i + 1]!);

    if (!current || !next) {
      issues.push(`Evidence ${evidenceIds[i]} or ${evidenceIds[i + 1]} not found`);
      continue;
    }

    const currentTime = new Date(current.submitted_at).getTime();
    const nextTime = new Date(next.submitted_at).getTime();

    if (nextTime < currentTime) {
      issues.push(
        `Temporal order violation: ${evidenceIds[i + 1]} submitted before ${evidenceIds[i]}`,
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export async function calculateEvidenceScore(
  disputeId: string,
): Promise<number> {
  const dispute = await prisma.dispute.findUnique({
    where: { dispute_id: disputeId },
  });

  if (!dispute) return 0;

  const evidenceList = ((dispute.evidence as unknown) as EvidenceWithMeta[]) ?? [];

  if (evidenceList.length === 0) return 0;

  const scores = await Promise.all(
    evidenceList.map(async (evidence) => {
      const integrity = await validateEvidenceIntegrity(evidence.evidence_id);
      const typeScore = getEvidenceTypeScore(evidence.type);
      const verifiedBonus = evidence.verified ? 0.2 : 0;
      return Math.min(1, typeScore * integrity.score + verifiedBonus);
    }),
  );

  // Weighted average: more evidence provides higher confidence
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const countBonus = Math.min(0.2, evidenceList.length * 0.05);
  return Math.min(1, avg + countBonus);
}

function getEvidenceTypeScore(type: EvidenceType | string): number {
  switch (type) {
    case 'transaction_record':
    case 'asset_hash':
      return 1.0;
    case 'log':
      return 0.9;
    case 'api_response':
      return 0.85;
    case 'screenshot':
      return 0.6;
    case 'testimony':
      return 0.5;
    default:
      return 0.4;
  }
}

export async function detectTampering(
  evidence: Evidence,
): Promise<{ tampered: boolean; confidence: number; details: string }> {
  const expectedHash = await computeHash(evidence.content);
  const hashMatches = expectedHash === evidence.hash;

  if (hashMatches) {
    return {
      tampered: false,
      confidence: 0.95,
      details: 'Hash integrity verified',
    };
  }

  // Check for common tampering patterns
  const content = evidence.content;
  const issues: string[] = [];

  if (content.length < 10) {
    issues.push('Content suspiciously short');
  }

  // Check for suspicious timestamp patterns
  const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g;
  const timestamps = content.match(timestampPattern);
  if (timestamps && timestamps.length > 1) {
    const times = timestamps.map((t) => new Date(t).getTime()).sort();
    for (let i = 0; i < times.length - 1; i++) {
      if (times[i + 1]! < times[i]!) {
        issues.push('Timestamps out of order in evidence');
        break;
      }
    }
  }

  return {
    tampered: true,
    confidence: 0.8,
    details:
      issues.length > 0
        ? `Potential tampering indicators: ${issues.join('; ')}`
        : 'Hash mismatch detected without clear explanation',
  };
}

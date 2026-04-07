import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type {
  HallucinationCheck,
  TrustAnchor,
  MemoryGraphNode,
  MemoryGraphEdge,
  CapabilityChain,
} from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

// ------------------------------------------------------------------
// Hallucination Checks
// ------------------------------------------------------------------

export async function performCheck(
  nodeId: string,
  codeContent: string,
  validationType: string,
  assetId?: string,
): Promise<HallucinationCheck> {
  if (!codeContent || codeContent.trim().length === 0) {
    throw new ValidationError('code_content is required and cannot be empty');
  }
  if (!validationType) {
    throw new ValidationError('validation_type is required');
  }

  // Run lightweight heuristic checks
  const alerts: string[] = [];
  const lines = codeContent.split('\n');

  // Check 1: TODO/FIXME left in code
  const todoMatches = lines.filter(
    (l) => /\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b/.test(l),
  );
  if (todoMatches.length > 0) {
    alerts.push(`Found ${todoMatches.length} TODO/FIXME/HACK comment(s) in code`);
  }

  // Check 2: Hardcoded credentials / secrets patterns
  const secretPatterns = [
    /password\s*=\s*["'][^"']{3,}/i,
    /api[_-]?key\s*=\s*["'][^"']{8,}/i,
    /secret\s*=\s*["'][^"']{8,}/i,
    /token\s*=\s*["'][^"']{8,}/i,
  ];
  for (const pattern of secretPatterns) {
    const matches = lines.filter((l) => pattern.test(l));
    if (matches.length > 0) {
      alerts.push('Potential hardcoded secret or credential detected');
      break;
    }
  }

  // Check 3: Placeholder / stub patterns
  const placeholderPatterns = [
    /\breturn\s+null\s*;/,
    /\breturn\s+0\s*;/,
    /\bpass\b/,
    /\b...\s*$/,
    /not\s+implemented/i,
    /todo/i,
  ];
  for (const pattern of placeholderPatterns) {
    const matches = lines.filter((l) => pattern.test(l) && !l.trim().startsWith('//'));
    if (matches.length > 5) {
      alerts.push('Multiple placeholder or stub patterns detected');
      break;
    }
  }

  // Check 4: Magic numbers (repeated numeric literals)
  const magicNumbers = lines
    .map((l) => (l.match(/\b\d+\b/g) || []).filter((n) => n.length > 1))
    .flat();
  const magicCount: Record<string, number> = {};
  for (const num of magicNumbers) {
    magicCount[num] = (magicCount[num] || 0) + 1;
  }
  const repeatedMagic = Object.entries(magicCount).filter(([, c]) => c >= 3);
  if (repeatedMagic.length > 0) {
    alerts.push('Repeated magic numbers detected (consider using named constants)');
  }

  // Build result
  const hasAlerts = alerts.length > 0;
  const result = {
    has_hallucination: hasAlerts,
    alert_count: alerts.length,
    checks_passed: !hasAlerts,
    summary: hasAlerts
      ? `Detected ${alerts.length} potential issue(s) in code`
      : 'No obvious hallucinations detected',
    details: alerts,
  };

  // Confidence: higher when code is longer and fewer alerts
  const confidence = Math.max(
    0.1,
    Math.min(0.99, 1 - alerts.length * 0.15 + (codeContent.length / 10000) * 0.05),
  );

  const check = await prisma.hallucinationCheck.create({
    data: {
      check_id: crypto.randomUUID(),
      node_id: nodeId,
      asset_id: assetId ?? null,
      code_content: codeContent,
      result: result as unknown as Prisma.InputJsonValue,
      confidence,
      alerts: alerts as unknown as Prisma.InputJsonValue,
      validation_type: validationType,
    },
  });

  return check as unknown as HallucinationCheck;
}

export async function getCheck(checkId: string): Promise<HallucinationCheck | null> {
  const check = await prisma.hallucinationCheck.findUnique({
    where: { check_id: checkId },
  });
  return check as unknown as HallucinationCheck | null;
}

export async function listChecks(
  nodeId: string,
  limit = 20,
  offset = 0,
): Promise<{ items: HallucinationCheck[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.hallucinationCheck.findMany({
      where: { node_id: nodeId },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.hallucinationCheck.count({ where: { node_id: nodeId } }),
  ]);
  return { items: items as unknown as HallucinationCheck[], total };
}

// ------------------------------------------------------------------
// Trust Anchors
// ------------------------------------------------------------------

export async function listAnchors(
  type?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: TrustAnchor[]; total: number }> {
  const where = type ? { type } : {};
  const [items, total] = await Promise.all([
    prisma.trustAnchor.findMany({
      where,
      orderBy: { verified_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.trustAnchor.count({ where }),
  ]);
  return { items: items as unknown as TrustAnchor[], total };
}

export async function addAnchor(
  type: string,
  source: string,
  confidence: number,
  expiresAt: Date,
): Promise<TrustAnchor> {
  if (!type) {
    throw new ValidationError('type is required');
  }
  if (!source) {
    throw new ValidationError('source is required');
  }
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new ValidationError('confidence must be a number between 0 and 1');
  }
  if (!expiresAt || expiresAt <= new Date()) {
    throw new ValidationError('expires_at must be a future date');
  }

  const anchor = await prisma.trustAnchor.create({
    data: { type, source, confidence, expires_at: expiresAt },
  });
  return anchor as unknown as TrustAnchor;
}

// ------------------------------------------------------------------
// Memory Graph Nodes
// ------------------------------------------------------------------

export async function listGraphNodes(
  type?: string,
  minConfidence?: number,
  limit = 20,
  offset = 0,
): Promise<{ items: MemoryGraphNode[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (minConfidence !== undefined) where.confidence = { gte: minConfidence };

  const [items, total] = await Promise.all([
    prisma.memoryGraphNode.findMany({
      where,
      orderBy: { gdi_score: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.memoryGraphNode.count({ where }),
  ]);
  return { items: items as unknown as MemoryGraphNode[], total };
}

export async function getGraphNode(nodeId: string): Promise<MemoryGraphNode | null> {
  const node = await prisma.memoryGraphNode.findUnique({
    where: { node_id: nodeId },
  });
  return node as unknown as MemoryGraphNode | null;
}

export async function upsertGraphNode(
  nodeId: string,
  type: string,
  label: string,
  metadata?: Record<string, unknown>,
): Promise<MemoryGraphNode> {
  if (!nodeId) {
    throw new ValidationError('node_id is required');
  }
  if (!type) {
    throw new ValidationError('type is required');
  }
  if (!label) {
    throw new ValidationError('label is required');
  }

  const node = await prisma.memoryGraphNode.upsert({
    where: { node_id: nodeId },
    update: {
      type,
      label,
      metadata: metadata as unknown as Prisma.InputJsonValue | undefined,
      updated_at: new Date(),
    },
    create: {
      node_id: nodeId,
      type,
      label,
      metadata: metadata as unknown as Prisma.InputJsonValue | undefined,
    },
  });
  return node as unknown as MemoryGraphNode;
}

// ------------------------------------------------------------------
// Memory Graph Edges
// ------------------------------------------------------------------

export async function listGraphEdges(
  sourceId?: string,
  targetId?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: MemoryGraphEdge[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (sourceId) where.source_id = sourceId;
  if (targetId) where.target_id = targetId;

  const [items, total] = await Promise.all([
    prisma.memoryGraphEdge.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.memoryGraphEdge.count({ where }),
  ]);
  return { items: items as unknown as MemoryGraphEdge[], total };
}

export async function createGraphEdge(
  sourceId: string,
  targetId: string,
  relation: string,
  weight = 0.5,
): Promise<MemoryGraphEdge> {
  if (!sourceId) {
    throw new ValidationError('source_id is required');
  }
  if (!targetId) {
    throw new ValidationError('target_id is required');
  }
  if (!relation) {
    throw new ValidationError('relation is required');
  }
  if (isNaN(weight) || weight < 0 || weight > 1) {
    throw new ValidationError('weight must be a number between 0 and 1');
  }

  // Verify both nodes exist
  const [sourceNode, targetNode] = await Promise.all([
    prisma.memoryGraphNode.findUnique({ where: { node_id: sourceId } }),
    prisma.memoryGraphNode.findUnique({ where: { node_id: targetId } }),
  ]);

  if (!sourceNode) {
    throw new NotFoundError('MemoryGraphNode', sourceId);
  }
  if (!targetNode) {
    throw new NotFoundError('MemoryGraphNode', targetId);
  }

  const edge = await prisma.memoryGraphEdge.create({
    data: { source_id: sourceId, target_id: targetId, relation, weight },
  });
  return edge as unknown as MemoryGraphEdge;
}

// ------------------------------------------------------------------
// Capability Chains
// ------------------------------------------------------------------

export async function getCapabilityChain(
  rootAssetId: string,
): Promise<CapabilityChain | null> {
  const chain = await prisma.capabilityChain.findFirst({
    where: { root_asset_id: rootAssetId },
    orderBy: { constructed_at: 'desc' },
  });
  return chain as unknown as CapabilityChain | null;
}

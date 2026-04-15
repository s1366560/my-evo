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

const FORBIDDEN_PATTERNS = [
  {
    id: 'todo-fixme-hack',
    category: 'maintainability',
    description: 'TODO, FIXME, HACK, or XXX markers left in code',
  },
  {
    id: 'hardcoded-secrets',
    category: 'security',
    description: 'Potential hardcoded secrets, API keys, passwords, or tokens',
  },
  {
    id: 'placeholder-stubs',
    category: 'correctness',
    description: 'Placeholder implementations or not-implemented stubs',
  },
  {
    id: 'repeated-magic-numbers',
    category: 'quality',
    description: 'Repeated numeric literals that should likely be named constants',
  },
] as const;

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
  language?: string,
  trustAnchors?: Array<{
    type: string;
    source: string;
    confidence: number;
  }>,
): Promise<HallucinationCheck> {
  if (!codeContent || codeContent.trim().length === 0) {
    throw new ValidationError('code_content is required and cannot be empty');
  }
  if (!validationType) {
    throw new ValidationError('validation_type is required');
  }

  // Run lightweight heuristic checks
  const alertMessages: string[] = [];
  const alertObjects: Array<{
    type: string;
    level: 'L1' | 'L2' | 'L3';
    message: string;
    suggestion: string;
    line: number | null;
    confidence: number;
  }> = [];
  const lines = codeContent.split('\n');

  const findFirstMatchingLine = (pattern: RegExp): number | null => {
    const index = lines.findIndex((line) => pattern.test(line));
    return index >= 0 ? index + 1 : null;
  };

  // Check 1: TODO/FIXME left in code
  const todoMatches = lines.filter(
    (l) => /\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b/.test(l),
  );
  if (todoMatches.length > 0) {
    const message = `Found ${todoMatches.length} TODO/FIXME/HACK comment(s) in code`;
    alertMessages.push(message);
    alertObjects.push({
      type: 'todo_marker',
      level: 'L1',
      message,
      suggestion: 'Resolve or remove TODO/FIXME/HACK markers before publishing the asset.',
      line: findFirstMatchingLine(/\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b/),
      confidence: 0.9,
    });
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
      const message = 'Potential hardcoded secret or credential detected';
      alertMessages.push(message);
      alertObjects.push({
        type: 'hardcoded_secret',
        level: 'L3',
        message,
        suggestion: 'Move credentials to environment variables or a secrets manager.',
        line: findFirstMatchingLine(pattern),
        confidence: 0.95,
      });
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
      const message = 'Multiple placeholder or stub patterns detected';
      alertMessages.push(message);
      alertObjects.push({
        type: 'placeholder_stub',
        level: 'L2',
        message,
        suggestion: 'Replace placeholder logic with a real implementation or block publication.',
        line: findFirstMatchingLine(pattern),
        confidence: 0.85,
      });
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
    const message = 'Repeated magic numbers detected (consider using named constants)';
    alertMessages.push(message);
    alertObjects.push({
      type: 'magic_number',
      level: 'L1',
      message,
      suggestion: 'Extract repeated numeric literals into named constants.',
      line: findFirstMatchingLine(/\b\d+\b/),
      confidence: 0.75,
    });
  }

  // Build result
  const hasAlerts = alertMessages.length > 0;
  const result = {
    has_hallucination: hasAlerts,
    alert_count: alertMessages.length,
    checks_passed: !hasAlerts,
    summary: hasAlerts
      ? `Detected ${alertMessages.length} potential issue(s) in code`
      : 'No obvious hallucinations detected',
    details: alertMessages,
    alerts: alertObjects,
    suggestions: alertObjects.map((alert) => alert.suggestion),
    language: language ?? null,
    trust_anchors_used: trustAnchors ?? [],
  };

  // Confidence: higher when code is longer and fewer alerts
  const confidence = Math.max(
    0.1,
    Math.min(0.99, 1 - alertMessages.length * 0.15 + (codeContent.length / 10000) * 0.05),
  );

  const check = await prisma.hallucinationCheck.create({
    data: {
      check_id: crypto.randomUUID(),
      node_id: nodeId,
      asset_id: assetId ?? null,
      code_content: codeContent,
      result: result as unknown as Prisma.InputJsonValue,
      confidence,
      alerts: alertMessages as unknown as Prisma.InputJsonValue,
      validation_type: validationType,
    },
  });

  return check as unknown as HallucinationCheck;
}

export async function validateCode(
  nodeId: string,
  codeContent: string,
  assetId?: string,
): Promise<HallucinationCheck> {
  return performCheck(nodeId, codeContent, 'validate', assetId);
}

export async function detectHallucination(
  nodeId: string,
  codeContent: string,
  assetId?: string,
): Promise<HallucinationCheck> {
  return performCheck(nodeId, codeContent, 'detect', assetId);
}

export async function getCheck(
  checkId: string,
  nodeId?: string,
): Promise<HallucinationCheck | null> {
  const check = await prisma.hallucinationCheck.findUnique({
    where: { check_id: checkId },
  });

  if (check && nodeId && check.node_id !== nodeId) {
    return null;
  }

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

export async function getConfidence(
  nodeId: string,
  query: {
    checkId?: string;
    assetId?: string;
  } = {},
): Promise<{
  check_id: string;
  asset_id: string | null;
  confidence: number;
  validation_type: string;
  has_hallucination: boolean;
  alert_count: number;
  summary: string | null;
  created_at: Date;
}> {
  let check: HallucinationCheck | null;

  if (query.checkId) {
    const directCheck = await prisma.hallucinationCheck.findUnique({
      where: { check_id: query.checkId },
    });
    check = directCheck as unknown as HallucinationCheck | null;
    if (!check || check.node_id !== nodeId) {
      throw new NotFoundError('HallucinationCheck', query.checkId);
    }
  } else {
    const latestCheck = await prisma.hallucinationCheck.findFirst({
      where: {
        node_id: nodeId,
        ...(query.assetId ? { asset_id: query.assetId } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
    check = latestCheck as unknown as HallucinationCheck | null;
    if (!check) {
      throw new NotFoundError('HallucinationCheck', query.assetId ?? nodeId);
    }
  }

  const result = (check.result ?? {}) as Record<string, unknown>;
  const alertCount = typeof result.alert_count === 'number'
    ? result.alert_count
    : Array.isArray(check.alerts)
      ? check.alerts.length
      : 0;

  return {
    check_id: check.check_id,
    asset_id: check.asset_id ?? null,
    confidence: check.confidence,
    validation_type: check.validation_type,
    has_hallucination: result.has_hallucination === true,
    alert_count: alertCount,
    summary: typeof result.summary === 'string' ? result.summary : null,
    created_at: check.created_at,
  };
}

export function listForbiddenPatterns(): Array<{
  id: string;
  category: string;
  description: string;
}> {
  return FORBIDDEN_PATTERNS.map((pattern) => ({ ...pattern }));
}

export async function getCheckStats(): Promise<{
  total_checks: number;
  avg_confidence: number;
  checks_with_alerts: number;
  alert_rate: number;
  recent_24h: number;
  by_validation_type: Record<string, number>;
}> {
  const checks = await prisma.hallucinationCheck.findMany({
    select: {
      validation_type: true,
      confidence: true,
      result: true,
      created_at: true,
    },
  });

  const totalChecks = checks.length;
  if (totalChecks === 0) {
    return {
      total_checks: 0,
      avg_confidence: 0,
      checks_with_alerts: 0,
      alert_rate: 0,
      recent_24h: 0,
      by_validation_type: {},
    };
  }

  const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
  let confidenceSum = 0;
  let checksWithAlerts = 0;
  let recent24h = 0;
  const byValidationType: Record<string, number> = {};

  for (const check of checks) {
    confidenceSum += check.confidence;
    if (check.created_at.getTime() >= recentThreshold) {
      recent24h += 1;
    }

    byValidationType[check.validation_type] = (byValidationType[check.validation_type] ?? 0) + 1;

    const result = (check.result ?? {}) as Record<string, unknown>;
    if (result.has_hallucination === true) {
      checksWithAlerts += 1;
    }
  }

  return {
    total_checks: totalChecks,
    avg_confidence: confidenceSum / totalChecks,
    checks_with_alerts: checksWithAlerts,
    alert_rate: checksWithAlerts / totalChecks,
    recent_24h: recent24h,
    by_validation_type: byValidationType,
  };
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

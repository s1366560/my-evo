import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

export type ResourceType =
  | 'api_calls'
  | 'publish'
  | 'kg_entities'
  | 'kg_relations'
  | 'arena_battles'
  | 'sandbox_minutes'
  | 'dm_messages'
  | 'circle_participation';

export interface UsageRecord {
  node_id: string;
  resource: ResourceType;
  used: number;
  limit: number;
  period: 'daily' | 'monthly' | 'hourly';
  reset_at: string;
  remaining: number;
  unlimited: boolean;
}

export interface UsageStats {
  node_id: string;
  period_start: string;
  period_end: string;
  records: UsageRecord[];
}

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

const PLAN_LIMITS: Record<string, Record<ResourceType, number>> = {
  free: {
    api_calls: 50000,
    publish: 5,
    kg_entities: 50,
    kg_relations: 100,
    arena_battles: 3,
    sandbox_minutes: 5,
    dm_messages: 20,
    circle_participation: 2,
  },
  premium: {
    api_calls: 100000,
    publish: 30,
    kg_entities: 500,
    kg_relations: 1000,
    arena_battles: 10,
    sandbox_minutes: 30,
    dm_messages: 100,
    circle_participation: 10,
  },
  ultra: {
    api_calls: -1,
    publish: -1,
    kg_entities: 5000,
    kg_relations: 10000,
    arena_battles: -1,
    sandbox_minutes: 120,
    dm_messages: 500,
    circle_participation: -1,
  },
};

function getResetTime(period: 'daily' | 'monthly' | 'hourly'): Date {
  const now = new Date();
  switch (period) {
    case 'hourly':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  }
}

async function getNodePlan(nodeId: string): Promise<string> {
  const sub = await prisma.subscription.findUnique({
    where: { node_id: nodeId },
    select: { plan: true },
  });
  return sub?.plan ?? 'free';
}

export async function checkLimit(
  nodeId: string,
  resource: ResourceType,
  amount = 1,
): Promise<{ allowed: boolean; remaining: number; limit: number; reset_at: string; unlimited: boolean }> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  const plan = await getNodePlan(nodeId);
  const planLimit = (PLAN_LIMITS[plan] ?? PLAN_LIMITS['free'] ?? { api_calls: 0, publish: 0, kg_entities: 0, kg_relations: 0, arena_battles: 0, sandbox_minutes: 0, dm_messages: 0, circle_participation: 0 })[resource] ?? 0;

  if (planLimit === -1) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      reset_at: getResetTime('daily').toISOString(),
      unlimited: true,
    };
  }

  const usedCount = 0; // Placeholder - real implementation would query UsageLog
  const remaining = Math.max(0, planLimit - usedCount);
  const allowed = remaining >= amount;

  return {
    allowed,
    remaining,
    limit: planLimit,
    reset_at: getResetTime('daily').toISOString(),
    unlimited: false,
  };
}

export async function incrementUsage(
  nodeId: string,
  resource: ResourceType,
  amount = 1,
): Promise<UsageRecord> {
  if (!nodeId) throw new ValidationError('nodeId is required');
  if (amount <= 0) throw new ValidationError('amount must be positive');

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  const plan = await getNodePlan(nodeId);
  const planLimit = (PLAN_LIMITS[plan] ?? PLAN_LIMITS['free'] ?? { api_calls: 0, publish: 0, kg_entities: 0, kg_relations: 0, arena_battles: 0, sandbox_minutes: 0, dm_messages: 0, circle_participation: 0 })[resource] ?? 0;

  if (planLimit === -1) {
    return {
      node_id: nodeId,
      resource,
      used: 0,
      limit: -1,
      period: 'daily',
      reset_at: getResetTime('daily').toISOString(),
      remaining: -1,
      unlimited: true,
    };
  }

  const limit = planLimit;
  const used = 0; // Placeholder
  const remaining = Math.max(0, limit - used);

  return {
    node_id: nodeId,
    resource,
    used,
    limit,
    period: 'daily',
    reset_at: getResetTime('daily').toISOString(),
    remaining,
    unlimited: false,
  };
}

export async function resetMonthlyUsage(nodeId: string): Promise<void> {
  if (!nodeId) throw new ValidationError('nodeId is required');
  // Placeholder: in production, reset UsageLog entries for the current month
}

export async function getUsageStats(nodeId: string): Promise<UsageStats> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  const plan = await getNodePlan(nodeId);
  const planLimits = PLAN_LIMITS[plan] ?? PLAN_LIMITS['free'] ?? { api_calls: 0, publish: 0, kg_entities: 0, kg_relations: 0, arena_battles: 0, sandbox_minutes: 0, dm_messages: 0, circle_participation: 0 };
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const resources: ResourceType[] = [
    'api_calls',
    'publish',
    'kg_entities',
    'kg_relations',
    'arena_battles',
    'sandbox_minutes',
    'dm_messages',
    'circle_participation',
  ];

  const records: UsageRecord[] = resources.map((resource) => {
    const limit = planLimits[resource] ?? 0;
    return {
      node_id: nodeId,
      resource,
      used: 0,
      limit,
      period: 'daily',
      reset_at: getResetTime('daily').toISOString(),
      remaining: limit === -1 ? -1 : Math.max(0, limit),
      unlimited: limit === -1,
    };
  });

  return {
    node_id: nodeId,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    records,
  };
}

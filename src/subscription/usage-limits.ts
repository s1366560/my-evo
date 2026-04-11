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
  window_start: string;
  window_end: string;
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

const KG_ENTITY_TAG = 'kg:entity';

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

const DEFAULT_PLAN_LIMITS: Record<ResourceType, number> = {
  api_calls: 0,
  publish: 0,
  kg_entities: 0,
  kg_relations: 0,
  arena_battles: 0,
  sandbox_minutes: 0,
  dm_messages: 0,
  circle_participation: 0,
};

const RESOURCE_PERIODS: Record<ResourceType, UsageRecord['period']> = {
  api_calls: 'daily',
  publish: 'daily',
  kg_entities: 'daily',
  kg_relations: 'daily',
  arena_battles: 'daily',
  sandbox_minutes: 'daily',
  dm_messages: 'daily',
  circle_participation: 'monthly',
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

function getPlanLimits(plan: string): Record<ResourceType, number> {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS['free'] ?? DEFAULT_PLAN_LIMITS;
}

function getPeriodWindow(period: UsageRecord['period']): { start: Date; end: Date } {
  const now = new Date();

  switch (period) {
    case 'hourly': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
      return { start, end: getResetTime('hourly') };
    }
    case 'daily': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { start, end: getResetTime('daily') };
    }
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end: getResetTime('monthly') };
    }
  }
}

async function countIfAvailable(
  delegate: { count?: (args: unknown) => Promise<number> } | undefined,
  args: unknown,
): Promise<number> {
  if (!delegate?.count) {
    return 0;
  }
  return delegate.count(args);
}

async function getCurrentUsage(nodeId: string, resource: ResourceType): Promise<number> {
  const period = RESOURCE_PERIODS[resource];
  const { start, end } = getPeriodWindow(period);
  const db = prisma as unknown as {
    asset?: { count?: (args: unknown) => Promise<number> };
    memoryNode?: { count?: (args: unknown) => Promise<number> };
    arenaMatch?: { count?: (args: unknown) => Promise<number> };
    directMessage?: { count?: (args: unknown) => Promise<number> };
    circle?: { count?: (args: unknown) => Promise<number> };
  };

  switch (resource) {
    case 'publish':
      return countIfAvailable(db.asset, {
        where: {
          author_id: nodeId,
          status: 'published',
          created_at: { gte: start, lt: end },
        },
      });
    case 'kg_entities':
      return countIfAvailable(db.asset, {
        where: {
          author_id: nodeId,
          tags: { has: KG_ENTITY_TAG },
          created_at: { gte: start, lt: end },
        },
      });
    case 'arena_battles':
      return countIfAvailable(db.arenaMatch, {
        where: {
          created_at: { gte: start, lt: end },
          OR: [{ challenger: nodeId }, { defender: nodeId }],
        },
      });
    case 'dm_messages':
      return countIfAvailable(db.directMessage, {
        where: {
          from_id: nodeId,
          created_at: { gte: start, lt: end },
        },
      });
    case 'circle_participation':
      return countIfAvailable(db.circle, {
        where: {
          creator_id: nodeId,
          created_at: { gte: start, lt: end },
        },
      });
    case 'api_calls':
    case 'kg_relations':
    case 'sandbox_minutes':
    default:
      return 0;
  }
}

function buildUsageRecord(
  nodeId: string,
  resource: ResourceType,
  used: number,
  limit: number,
): UsageRecord {
  const period = RESOURCE_PERIODS[resource];
  const { start, end } = getPeriodWindow(period);
  return {
    node_id: nodeId,
    resource,
    used,
    limit,
    period,
    window_start: start.toISOString(),
    window_end: end.toISOString(),
    reset_at: getResetTime(period).toISOString(),
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    unlimited: limit === -1,
  };
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
  const planLimit = getPlanLimits(plan)[resource] ?? 0;
  const period = RESOURCE_PERIODS[resource];

  if (planLimit === -1) {
    return {
      allowed: true,
      remaining: -1,
      limit: -1,
      reset_at: getResetTime(period).toISOString(),
      unlimited: true,
    };
  }

  const usedCount = await getCurrentUsage(nodeId, resource);
  const remaining = Math.max(0, planLimit - usedCount);
  const allowed = remaining >= amount;

  return {
    allowed,
    remaining,
    limit: planLimit,
    reset_at: getResetTime(period).toISOString(),
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
  const planLimit = getPlanLimits(plan)[resource] ?? 0;
  const period = RESOURCE_PERIODS[resource];
  const { start, end } = getPeriodWindow(period);

  if (planLimit === -1) {
    return {
      node_id: nodeId,
      resource,
      used: 0,
      limit: -1,
      period,
      window_start: start.toISOString(),
      window_end: end.toISOString(),
      reset_at: getResetTime(period).toISOString(),
      remaining: -1,
      unlimited: true,
    };
  }

  const limit = planLimit;
  const used = await getCurrentUsage(nodeId, resource);

  return buildUsageRecord(nodeId, resource, used, limit);
}

export async function resetMonthlyUsage(nodeId: string): Promise<void> {
  if (!nodeId) throw new ValidationError('nodeId is required');
  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);
  // Usage is derived from period-bounded source tables, so there is no separate log to clear.
}

export async function getUsageStats(nodeId: string): Promise<UsageStats> {
  if (!nodeId) throw new ValidationError('nodeId is required');

  const node = await prisma.node.findUnique({ where: { node_id: nodeId } });
  if (!node) throw new NotFoundError('Node', nodeId);

  const plan = await getNodePlan(nodeId);
  const planLimits = getPlanLimits(plan);
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

  const usages = await Promise.all(resources.map(async (resource) => ({
    resource,
    used: await getCurrentUsage(nodeId, resource),
  })));
  const records: UsageRecord[] = usages.map(({ resource, used }) =>
    buildUsageRecord(nodeId, resource, used, planLimits[resource] ?? 0));

  return {
    node_id: nodeId,
    period_start: records.reduce(
      (earliest, record) => record.window_start < earliest ? record.window_start : earliest,
      records[0]?.window_start ?? periodStart.toISOString(),
    ),
    period_end: records.reduce(
      (latest, record) => record.window_end > latest ? record.window_end : latest,
      records[0]?.window_end ?? periodEnd.toISOString(),
    ),
    records,
  };
}

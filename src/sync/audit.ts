import { PrismaClient } from '@prisma/client';
import type {
  SyncLogEntry,
  SyncMetrics,
  SyncPattern,
  SyncStep,
  SyncStatus,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function logSyncOperation(
  nodeId: string,
  operation: {
    step: SyncStep;
    status: SyncStatus;
    itemsSynced: number;
    error?: string;
  },
): Promise<SyncLogEntry> {
  const entry = await prisma.syncLog.create({
    data: {
      node_id: nodeId,
      step: operation.step,
      status: operation.status,
      items_synced: operation.itemsSynced,
      error: operation.error,
    },
  });

  await updateSyncState(nodeId, operation.status);

  return {
    id: entry.id,
    node_id: entry.node_id,
    step: entry.step as SyncStep,
    status: entry.status as SyncStatus,
    items_synced: entry.items_synced,
    error: entry.error || undefined,
    synced_at: entry.synced_at.toISOString(),
  };
}

async function updateSyncState(
  nodeId: string,
  status: SyncStatus,
): Promise<void> {
  const now = new Date();
  const isError = status === 'SYNC_ERROR';

  await prisma.syncState.upsert({
    where: { node_id: nodeId },
    update: {
      last_sync_at: now,
      status,
      sync_count: { increment: 1 },
      error_count: isError ? { increment: 1 } : undefined,
      next_sync_at: new Date(now.getTime() + 300_000),
    },
    create: {
      node_id: nodeId,
      status,
      last_sync_at: now,
      sync_count: 1,
      error_count: isError ? 1 : 0,
      next_sync_at: new Date(now.getTime() + 300_000),
    },
  });
}

export async function getSyncHistory(
  nodeId: string,
  limit: number = 50,
): Promise<SyncLogEntry[]> {
  const logs = await prisma.syncLog.findMany({
    where: { node_id: nodeId },
    orderBy: { synced_at: 'desc' },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    node_id: log.node_id,
    step: log.step as SyncStep,
    status: log.status as SyncStatus,
    items_synced: log.items_synced,
    error: log.error || undefined,
    synced_at: log.synced_at.toISOString(),
  }));
}

export async function analyzeSyncPatterns(
  nodeId: string,
): Promise<SyncPattern> {
  const logs = await prisma.syncLog.findMany({
    where: { node_id: nodeId, status: { in: ['SYNCED', 'SYNCING'] } },
    orderBy: { synced_at: 'desc' },
    take: 100,
  });

  if (logs.length === 0) {
    return {
      average_interval_ms: 300_000,
      typical_sync_time: '00:00',
      peak_sync_hour: 0,
      activity_level: 'low',
      suggested_interval_ms: 600_000,
    };
  }

  let totalInterval = 0;
  const hourCounts: number[] = new Array(24).fill(0);

  for (let i = 0; i < logs.length - 1; i++) {
    const currentLog = logs[i];
    const prevLog = logs[i + 1];
    if (currentLog && prevLog) {
      const current = new Date(currentLog.synced_at).getTime();
      const prev = new Date(prevLog.synced_at).getTime();
      totalInterval += current - prev;
    }
  }

  for (const log of logs) {
    const hour = new Date(log.synced_at).getHours();
    const count = hourCounts[hour];
    if (count !== undefined) {
      hourCounts[hour] = count + 1;
    }
  }

  const avgInterval = logs.length > 1 ? totalInterval / (logs.length - 1) : 300_000;
  const maxCount = Math.max(...hourCounts);
  const peakHour = hourCounts.indexOf(maxCount);

  let activityLevel: 'low' | 'medium' | 'high' = 'low';
  if (avgInterval < 360_000) activityLevel = 'high';
  else if (avgInterval < 900_000) activityLevel = 'medium';

  return {
    average_interval_ms: Math.round(avgInterval),
    typical_sync_time: `${peakHour.toString().padStart(2, '0')}:00`,
    peak_sync_hour: peakHour,
    activity_level: activityLevel,
    suggested_interval_ms: Math.round(avgInterval * 0.8),
  };
}

export async function getSyncMetrics(
  nodeId: string,
): Promise<SyncMetrics> {
  const logs = await prisma.syncLog.findMany({
    where: { node_id: nodeId },
    orderBy: { synced_at: 'desc' },
    take: 100,
  });

  if (logs.length === 0) {
    return {
      node_id: nodeId,
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      average_items_per_sync: 0,
      average_duration_ms: 0,
      last_sync_duration_ms: 0,
      last_successful_sync: '',
      sync_success_rate: 0,
    };
  }

  const successfulSyncs = logs.filter((l) => l.status === 'SYNCED').length;
  const failedSyncs = logs.filter((l) => l.status === 'SYNC_ERROR').length;
  const totalItems = logs.reduce((sum, l) => sum + l.items_synced, 0);
  const lastSuccessful = logs.find((l) => l.status === 'SYNCED');

  return {
    node_id: nodeId,
    total_syncs: logs.length,
    successful_syncs: successfulSyncs,
    failed_syncs: failedSyncs,
    average_items_per_sync: Math.round(totalItems / logs.length),
    average_duration_ms: 0,
    last_sync_duration_ms: 0,
    last_successful_sync: lastSuccessful
      ? lastSuccessful.synced_at.toISOString()
      : '',
    sync_success_rate: Math.round((successfulSyncs / logs.length) * 100),
  };
}

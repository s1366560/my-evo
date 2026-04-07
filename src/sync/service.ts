import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import {
  SYNC_INTERVAL_MS,
  SYNC_BATCH_SIZE,
} from '../shared/constants';
import {
  ValidationError,
  NotFoundError,
} from '../shared/errors';
import {
  initializeScheduler,
  scheduleSync,
  cancelScheduledSync,
  getScheduledJobs,
} from './scheduler';
import {
  calculateSyncDelta,
  applyIncrementalSync,
  verifySyncIntegrity,
} from './incremental';
import {
  detectConflicts,
  applyConflictResolution,
} from './conflict-resolution';
import {
  logSyncOperation,
  getSyncHistory,
  analyzeSyncPatterns,
  getSyncMetrics,
} from './audit';
import {
  saveCheckpoint,
  loadCheckpoint,
  resumeInterruptedSync,
  clearCheckpoint,
} from './resume';
import type {
  SyncStatus,
  SyncStep,
  SyncJobData,
  ScheduledSync,
  TriggerSyncResult,
  SyncStatusResult,
  ConflictStrategy,
  ChangeVersion,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

export async function initialize(): Promise<void> {
  await initializeScheduler();
}

export async function triggerPeriodicSync(nodeId: string): Promise<TriggerSyncResult> {
  const syncId = `sync_${uuidv4()}`;

  await logSyncOperation(nodeId, {
    step: 'FETCH',
    status: 'SYNCING',
    itemsSynced: 0,
  });

  try {
    const delta = await calculateSyncDelta(nodeId);

    await logSyncOperation(nodeId, {
      step: 'PUBLISH',
      status: 'SYNCING',
      itemsSynced: delta.total_changes,
    });

    if (delta.total_changes > 0) {
      const result = await applyIncrementalSync(nodeId, delta.changes);

      if (result.errors.length > 0) {
        await logSyncOperation(nodeId, {
          step: 'CHECK',
          status: 'SYNC_ERROR',
          itemsSynced: result.applied,
          error: result.errors.join('; '),
        });

        return {
          sync_id: syncId,
          status: 'SYNC_ERROR',
          message: `Sync completed with ${result.errors.length} errors`,
        };
      }
    }

    await logSyncOperation(nodeId, {
      step: 'CHECK',
      status: 'SYNCED',
      itemsSynced: delta.total_changes,
    });

    return {
      sync_id: syncId,
      status: 'SYNCED',
      message: `Successfully synced ${delta.total_changes} changes`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await logSyncOperation(nodeId, {
      step: 'CHECK',
      status: 'SYNC_ERROR',
      itemsSynced: 0,
      error: errorMsg,
    });

    return {
      sync_id: syncId,
      status: 'SYNC_ERROR',
      message: `Sync failed: ${errorMsg}`,
    };
  }
}

export async function getNodeSyncStatus(nodeId: string): Promise<SyncStatusResult> {
  const syncState = await prisma.syncState.findUnique({
    where: { node_id: nodeId },
  });

  if (!syncState) {
    return {
      node_id: nodeId,
      status: 'SYNCING',
      last_sync_at: new Date(0).toISOString(),
      next_sync_at: new Date(Date.now() + SYNC_INTERVAL_MS).toISOString(),
      sync_count: 0,
      error_count: 0,
    };
  }

  return {
    node_id: syncState.node_id,
    status: syncState.status as SyncStatus,
    last_sync_at: syncState.last_sync_at.toISOString(),
    next_sync_at: syncState.next_sync_at.toISOString(),
    sync_count: syncState.sync_count,
    error_count: syncState.error_count,
  };
}

export async function syncNodeAssets(
  nodeId: string,
  remoteAssets: Array<{ asset_id: string; version: ChangeVersion }>,
): Promise<{ merged: number; conflicts: number }> {
  const localAssets = await prisma.asset.findMany({
    where: { author_id: nodeId },
    select: { asset_id: true, version: true, updated_at: true },
  });

  const localMap: Record<string, ChangeVersion> = {};
  for (const asset of localAssets) {
    localMap[asset.asset_id] = {
      version: asset.version,
      updated_at: asset.updated_at.toISOString(),
      node_id: nodeId,
      content_hash: '',
    };
  }

  const remoteMap: Record<string, ChangeVersion> = {};
  for (const asset of remoteAssets) {
    remoteMap[asset.asset_id] = asset.version;
  }

  const conflictResult = detectConflicts(localMap, remoteMap);
  const resolved = applyConflictResolution(conflictResult.conflicts, 'last_write_wins');

  return {
    merged: remoteAssets.length,
    conflicts: conflictResult.conflicts.length,
  };
}

export async function scheduleNodeSync(
  nodeId: string,
  intervalMs?: number,
): Promise<ScheduledSync> {
  return scheduleSync(nodeId, intervalMs);
}

export async function cancelNodeSync(jobId: string): Promise<boolean> {
  return cancelScheduledSync(jobId);
}

export async function listScheduledSyncs(): Promise<ScheduledSync[]> {
  return getScheduledJobs();
}

export async function performIncrementalSync(
  nodeId: string,
  strategy: ConflictStrategy = 'last_write_wins',
): Promise<{ changes: number; applied: number }> {
  const delta = await calculateSyncDelta(nodeId);
  const result = await applyIncrementalSync(nodeId, delta.changes);

  await logSyncOperation(nodeId, {
    step: 'CHECK',
    status: result.errors.length > 0 ? 'SYNC_ERROR' : 'SYNCED',
    itemsSynced: result.applied,
    error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
  });

  return {
    changes: delta.total_changes,
    applied: result.applied,
  };
}

export async function checkSyncIntegrity(nodeId: string): Promise<{
  is_integral: boolean;
  missing_count: number;
  issues: string[];
}> {
  return verifySyncIntegrity(nodeId);
}

export async function fetchSyncHistory(
  nodeId: string,
  limit: number = 50,
): Promise<ReturnType<typeof getSyncHistory>> {
  return getSyncHistory(nodeId, limit);
}

export async function fetchSyncPatterns(
  nodeId: string,
): Promise<ReturnType<typeof analyzeSyncPatterns>> {
  return analyzeSyncPatterns(nodeId);
}

export async function fetchSyncMetrics(
  nodeId: string,
): Promise<ReturnType<typeof getSyncMetrics>> {
  return getSyncMetrics(nodeId);
}

export async function checkpointSync(
  syncId: string,
  position: number,
  total: number,
  step: SyncStep,
  lastAssetId?: string,
) {
  return saveCheckpoint(syncId, position, total, step, lastAssetId);
}

export async function loadSyncCheckpoint(syncId: string) {
  return loadCheckpoint(syncId);
}

export async function resumeSync(syncId: string) {
  return resumeInterruptedSync(syncId);
}

export async function clearSyncCheckpoint(syncId: string) {
  return clearCheckpoint(syncId);
}

import { PrismaClient } from '@prisma/client';
import type {
  IncrementalChange,
  SyncDelta,
} from './types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export { prisma };

export async function getIncrementalChanges(
  nodeId: string,
  since: Date,
): Promise<IncrementalChange[]> {
  const assets = await prisma.asset.findMany({
    where: {
      updated_at: { gte: since },
    },
    orderBy: { updated_at: 'asc' },
  });

  const deletedAssets = await prisma.evolutionEvent.groupBy({
    by: ['asset_id'],
    where: {
      event_type: 'revoked',
      timestamp: { gte: since },
    },
  });

  const deletedSet = new Set(deletedAssets.map((e) => e.asset_id));

  const changes: IncrementalChange[] = assets.map((asset) => ({
    asset_id: asset.asset_id,
    asset_type: asset.asset_type,
    change_type: deletedSet.has(asset.asset_id) ? 'delete' : 'update',
    version: asset.version,
    changed_at: asset.updated_at.toISOString(),
    content_hash: hashContent(asset.content || `${asset.name}:${asset.description}`),
  }));

  for (const deleted of deletedAssets) {
    if (!changes.find((c) => c.asset_id === deleted.asset_id)) {
      changes.push({
        asset_id: deleted.asset_id,
        asset_type: 'unknown',
        change_type: 'delete',
        version: 0,
        changed_at: new Date().toISOString(),
        content_hash: '',
      });
    }
  }

  return changes;
}

export async function calculateSyncDelta(
  nodeId: string,
): Promise<SyncDelta> {
  const syncState = await prisma.syncState.findUnique({
    where: { node_id: nodeId },
  });

  const lastSyncTime = syncState?.last_sync_at || new Date(0);
  const currentTime = new Date();

  const changes = await getIncrementalChanges(nodeId, lastSyncTime);

  return {
    node_id: nodeId,
    changes,
    last_sync_time: lastSyncTime.toISOString(),
    current_time: currentTime.toISOString(),
    total_changes: changes.length,
  };
}

export async function applyIncrementalSync(
  nodeId: string,
  changes: IncrementalChange[],
): Promise<{ applied: number; skipped: number; errors: string[] }> {
  let applied = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const change of changes) {
    try {
      if (change.change_type === 'delete') {
        skipped++;
        continue;
      }

      const existing = await prisma.asset.findUnique({
        where: { asset_id: change.asset_id },
      });

      if (existing && existing.version >= change.version) {
        skipped++;
        continue;
      }

      applied++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to apply ${change.asset_id}: ${msg}`);
    }
  }

  return { applied, skipped, errors };
}

export async function verifySyncIntegrity(
  nodeId: string,
): Promise<{ is_integral: boolean; missing_count: number; issues: string[] }> {
  const issues: string[] = [];

  const syncState = await prisma.syncState.findUnique({
    where: { node_id: nodeId },
  });

  if (!syncState) {
    issues.push('No sync state found for node');
  }

  const recentLogs = await prisma.syncLog.findMany({
    where: { node_id: nodeId },
    orderBy: { synced_at: 'desc' },
    take: 10,
  });

  if (recentLogs.length === 0) {
    issues.push('No sync logs found');
  }

  const errorLogs = recentLogs.filter((l) => l.status === 'SYNC_ERROR');
  if (errorLogs.length > 0) {
    issues.push(`${errorLogs.length} recent sync errors detected`);
  }

  const assets = await prisma.asset.findMany({
    where: { author_id: nodeId },
    select: { asset_id: true, version: true },
  });

  const missingCount = assets.filter(
    (a) => a.version <= 0,
  ).length;

  if (missingCount > 0) {
    issues.push(`${missingCount} assets with invalid version`);
  }

  return {
    is_integral: issues.length === 0,
    missing_count: missingCount,
    issues,
  };
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

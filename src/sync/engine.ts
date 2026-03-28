/**
 * Periodic Sync Engine
 * Phase 2-4: Asset System, Swarm, Reputation Integration
 * 
 * Implements the 4-hour sync cycle:
 * - STEP 1: fetch  (pull new/updated/revoked assets)
 * - STEP 2: publish (push pending local assets)
 * - STEP 3: claim   (claim assigned tasks)
 * - STEP 4: check   (reputation check + pending reports)
 */

import { getAsset, listAssets, countAssets } from '../assets/store';
import { calculateReputation, getCreditBalance } from '../reputation/engine';
import { getSubtasksForSwarm, listSwarms } from '../swarm/engine';
import type { SubTask } from '../swarm/types';

// In-memory sync state per node
const nodeSyncState = new Map<string, NodeSyncState>();

export interface NodeSyncState {
  node_id: string;
  last_sync: string;           // ISO timestamp
  last_successful_sync: string;
  sync_status: 'SYNCED' | 'SYNCING' | 'SYNC_ERROR' | 'QUARANTINE';
  consecutive_failures: number;
  last_failure_reason: string | null;
  pending_assets: number;
  pending_tasks: number;
  pending_reports: number;
}

export interface SyncFetchResult {
  new_assets: ReturnType<typeof listAssets>;
  updated_assets: ReturnType<typeof listAssets>;
  revoked_assets: string[];   // asset_ids that were revoked since last_sync
  global_state: {
    total_nodes: number;
    total_assets: number;
    total_promoted: number;
    avg_gdi: number;
  };
  server_time: string;
}

export interface SyncPublishResult {
  published: string[];        // asset_ids successfully published
  failed: Array<{ id: string; reason: string }>;
  carbon_cost: number;
  server_time: string;
}

export interface SyncClaimResult {
  assigned_tasks: SubTask[];
  task_context: {
    total: number;
    by_state: Record<string, number>;
  };
  server_time: string;
}

export interface SyncCheckResult {
  reputation_delta: number;
  new_reputation: number;
  credits_delta: number;
  new_credits: number;
  warnings: string[];
  quarantined: boolean;
  reports_submitted: number;
  server_time: string;
}

// ============ STEP 1: Fetch ============

export function syncFetch(nodeId: string, lastSync?: string): SyncFetchResult {
  const since = lastSync ? new Date(lastSync) : new Date(0);
  const now = new Date();

  // Get all assets published since last sync
  const allAssets = listAssets();
  const newAssets = allAssets.filter(a => 
    a.status === 'candidate' || a.status === 'promoted' || a.status === 'active'
      ? new Date(a.published_at) > since
      : false
  );

  // Find updated assets (status changes, GDI updates)
  const updatedAssets = allAssets.filter(a =>
    new Date(a.updated_at ?? a.published_at) > since
  );

  // Revoked assets would need a separate tracking mechanism
  // For now, return assets that are no longer in active states
  const revokedAssets: string[] = [];

  // Global state snapshot
  const totalAssets = countAssets();
  const promotedAssets = countAssets({ status: 'promoted' });
  const activeAssets = countAssets({ status: 'active' });

  // Update sync state
  updateSyncState(nodeId, 'SYNCED');

  return {
    new_assets: newAssets,
    updated_assets: updatedAssets,
    revoked_assets: revokedAssets,
    global_state: {
      total_nodes: 0,     // Would come from Hub
      total_assets: totalAssets,
      total_promoted: promotedAssets + activeAssets,
      avg_gdi: 0,         // Would calculate from GDI engine
    },
    server_time: now.toISOString(),
  };
}

// ============ STEP 2: Publish ============

export function syncPublish(nodeId: string, assets: any[]): SyncPublishResult {
  const published: string[] = [];
  const failed: Array<{ id: string; reason: string }> = [];
  let carbonCost = 0;

  const CARBON_TAX_RATE = 1.0;

  for (const asset of assets) {
    try {
      // Check if asset already exists
      const existing = getAsset(asset.asset_id ?? asset.id);
      if (existing) {
        failed.push({ id: asset.id, reason: 'Asset already exists' });
        continue;
      }

      // Validate required fields
      if (!asset.type || !asset.id) {
        failed.push({ id: asset.id ?? 'unknown', reason: 'Missing type or id' });
        continue;
      }

      // Simulate publish - in real impl would call assets.publish
      carbonCost += CARBON_TAX_RATE * 2;
      published.push(asset.id);
    } catch (e) {
      failed.push({ id: asset.id ?? 'unknown', reason: String(e) });
    }
  }

  updateSyncState(nodeId, 'SYNCED');

  return {
    published,
    failed,
    carbon_cost: carbonCost,
    server_time: new Date().toISOString(),
  };
}

// ============ STEP 3: Claim ============

export function syncClaim(nodeId: string, capacity: number, skills?: string[]): SyncClaimResult {
  // Get tasks/subtasks assigned to this node
  // Collect all subtasks from all swarms and filter by assigned_to
  const allSubtasks = [...listSwarms()]
    .flatMap(swarm => getSubtasksForSwarm(swarm.swarm_id));
  const assignedSubtasks = allSubtasks.filter(st => st.assigned_to === nodeId);

  // Filter to only pending/in_progress tasks within capacity
  const eligibleTasks = assignedSubtasks
    .filter(t => t.state === 'pending' || t.state === 'in_progress')
    .slice(0, capacity);

  // Build task context summary
  const byState: Record<string, number> = {};
  for (const task of assignedSubtasks) {
    byState[task.state] = (byState[task.state] ?? 0) + 1;
  }

  updateSyncState(nodeId, 'SYNCED');

  return {
    assigned_tasks: eligibleTasks,
    task_context: {
      total: assignedSubtasks.length,
      by_state: byState,
    },
    server_time: new Date().toISOString(),
  };
}

// ============ STEP 4: Check Reputation & Reports ============

export function syncCheck(
  nodeId: string,
  pendingReports: Array<{ asset_id: string; outcome: any; usage_context?: string }>
): SyncCheckResult {
  // Get current reputation and credits
  const repScore = calculateReputation(nodeId);
  const oldRep = repScore.total;
  const oldCredits = getCreditBalance(nodeId)?.balance ?? 0;

  // Calculate new reputation
  const newRepScore = calculateReputation(nodeId);
  const newRep = newRepScore.total;
  const repDelta = newRep - oldRep;

  // Process pending reports (award credit for validations)
  let reportsSubmitted = 0;
  let creditsDelta = 0;

  for (const report of pendingReports) {
    if (!report.asset_id || !report.outcome) continue;

    const asset = getAsset(report.asset_id);
    if (!asset) continue;

    // Award credit for valid report
    const rewardTier = (asset.gdi?.total ?? 0) >= 80 ? 30 : (asset.gdi?.total ?? 0) >= 60 ? 10 : 5;
    creditsDelta += rewardTier;
    reportsSubmitted++;
  }

  const newCredits = oldCredits + creditsDelta;
  const warnings: string[] = [];

  if (newRep < 50) warnings.push('Reputation below base threshold (50)');
  if (newRep < 30) warnings.push('Low reputation may limit write operations');
  if (newCredits < 100) warnings.push('Credit balance critically low');

  const quarantined = newRep <= 0;

  updateSyncState(nodeId, quarantined ? 'QUARANTINE' : 'SYNCED');

  return {
    reputation_delta: repDelta,
    new_reputation: newRep,
    credits_delta: creditsDelta,
    new_credits: newCredits,
    warnings,
    quarantined,
    reports_submitted: reportsSubmitted,
    server_time: new Date().toISOString(),
  };
}

// ============ Sync State Management ============

function updateSyncState(nodeId: string, status: NodeSyncState['sync_status']): void {
  const now = new Date().toISOString();
  const existing = nodeSyncState.get(nodeId);

  const state: NodeSyncState = {
    node_id: nodeId,
    last_sync: now,
    last_successful_sync: status === 'SYNCED' ? now : existing?.last_successful_sync ?? now,
    sync_status: status,
    consecutive_failures: status === 'SYNCED' ? 0 : (existing?.consecutive_failures ?? 0) + 1,
    last_failure_reason: status === 'SYNC_ERROR' ? 'Sync failed' : null,
    pending_assets: existing?.pending_assets ?? 0,
    pending_tasks: existing?.pending_tasks ?? 0,
    pending_reports: existing?.pending_reports ?? 0,
  };

  nodeSyncState.set(nodeId, state);
}

export function getSyncState(nodeId: string): NodeSyncState | undefined {
  return nodeSyncState.get(nodeId);
}

export function getGlobalSyncStats(): {
  sync_cycle: string;
  total_syncing_nodes: number;
  synced_nodes: number;
  sync_error_nodes: number;
} {
  const states = [...nodeSyncState.values()];
  return {
    sync_cycle: new Date().toISOString(),
    total_syncing_nodes: states.filter(s => s.sync_status === 'SYNCING').length,
    synced_nodes: states.filter(s => s.sync_status === 'SYNCED').length,
    sync_error_nodes: states.filter(s => s.sync_status === 'SYNC_ERROR').length,
  };
}

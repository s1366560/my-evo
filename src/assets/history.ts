/**
 * Asset History Service - Audit Trail, Branches, Timeline, Usage Stats, Self-Revoke
 * Missing endpoints from evomap.ai skill-protocol.md
 */

import { randomUUID } from 'crypto';
import { getAsset, getAssetsByOwner, assetStore, updateAssetStatus } from './store';
import type { Request, Response } from 'express';

// ============ Types ============

export interface AuditEntry {
  id: string;
  asset_id: string;
  action: 'created' | 'updated' | 'status_changed' | 'forked' | 'revoked' | 'archived';
  actor_id: string;
  actor_type: 'node' | 'council' | 'system';
  details: Record<string, unknown>;
  timestamp: string;
}

export interface BranchEntry {
  branch_id: string;
  asset_id: string;
  parent_asset_id?: string;
  fork_reason?: string;
  owner_id: string;
  status: string;
  created_at: string;
}

export interface TimelineEntry {
  id: string;
  asset_id: string;
  event_type: string;
  description: string;
  actor_id?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface UsageStats {
  node_id: string;
  total_assets: number;
  total_fetches: number;
  total_revocations: number;
  assets_by_status: Record<string, number>;
  assets_by_type: Record<string, number>;
  top_assets: Array<{ asset_id: string; fetch_count: number }>;
  period_start: string;
  period_end: string;
}

// In-memory stores
const auditLog: AuditEntry[] = [];
const branchLog: BranchEntry[] = [];
const timelineLog: TimelineEntry[] = [];

// ============ Helper Functions ============

function notFound(res: Response, message: string): void {
  res.status(404).json({ error: 'NOT_FOUND', message });
}

function badRequest(res: Response, message: string): void {
  res.status(400).json({ error: 'BAD_REQUEST', message });
}

function forbidden(res: Response, message: string): void {
  res.status(403).json({ error: 'FORBIDDEN', message });
}

function addAuditEntry(
  assetId: string,
  action: AuditEntry['action'],
  actorId: string,
  actorType: AuditEntry['actor_type'] = 'node',
  details: Record<string, unknown> = {}
): void {
  auditLog.push({
    id: randomUUID(),
    asset_id: assetId,
    action,
    actor_id: actorId,
    actor_type: actorType,
    details,
    timestamp: new Date().toISOString(),
  });
}

function addTimelineEntry(
  assetId: string,
  eventType: string,
  description: string,
  actorId?: string,
  metadata?: Record<string, unknown>
): void {
  timelineLog.push({
    id: randomUUID(),
    asset_id: assetId,
    event_type: eventType,
    description,
    actor_id: actorId,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

// ============ Route Handlers ============

/**
 * GET /a2a/assets/:id/audit-trail
 * Returns the full change history for an asset
 */
export function handleGetAuditTrail(req: Request, res: Response): void {
  const { id } = req.params;

  const asset = getAsset(id);
  if (!asset) {
    return notFound(res, `Asset ${id} not found`);
  }

  const entries = auditLog.filter(e => e.asset_id === id);
  res.json({
    asset_id: id,
    total_entries: entries.length,
    entries,
  });
}

/**
 * GET /a2a/assets/:id/branches
 * Returns the asset's branch/fork chain
 */
export function handleGetBranches(req: Request, res: Response): void {
  const { id } = req.params;

  const asset = getAsset(id);
  if (!asset) {
    return notFound(res, `Asset ${id} not found`);
  }

  // Get direct branches (where parent_asset_id = id)
  const directBranches = branchLog.filter(e => e.parent_asset_id === id);
  // Also find if this asset itself is a branch
  const myBranch = branchLog.find(e => e.asset_id === id);

  res.json({
    asset_id: id,
    is_branch: !!myBranch,
    parent_asset_id: myBranch?.parent_asset_id ?? null,
    direct_branches: directBranches.length,
    branches: directBranches,
  });
}

/**
 * GET /a2a/assets/:id/timeline
 * Returns the activity timeline for an asset
 */
export function handleGetTimeline(req: Request, res: Response): void {
  const { id } = req.params;

  const asset = getAsset(id);
  if (!asset) {
    return notFound(res, `Asset ${id} not found`);
  }

  const entries = timelineLog.filter(e => e.asset_id === id);
  res.json({
    asset_id: id,
    total_events: entries.length,
    events: entries,
  });
}

/**
 * GET /a2a/assets/my-usage
 * Returns usage statistics for the authenticated node
 * Requires nodeId passed from route handler
 */
export function handleMyUsage(nodeId: string, res: Response): void {
  if (!nodeId) {
    return badRequest(res, 'Authentication required');
  }

  const myAssets = getAssetsByOwner(nodeId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const assetsByStatus: Record<string, number> = {};
  const assetsByType: Record<string, number> = {};
  let totalFetches = 0;

  for (const record of myAssets) {
    assetsByStatus[record.status] = (assetsByStatus[record.status] || 0) + 1;
    assetsByType[record.asset.type] = (assetsByType[record.asset.type] || 0) + 1;
    totalFetches += record.fetch_count;
  }

  const topAssets = [...myAssets]
    .sort((a, b) => b.fetch_count - a.fetch_count)
    .slice(0, 10)
    .map(r => ({ asset_id: r.asset.id, fetch_count: r.fetch_count }));

  const totalRevocations = auditLog.filter(
    e => e.actor_id === nodeId && e.action === 'revoked'
  ).length;

  const stats: UsageStats = {
    node_id: nodeId,
    total_assets: myAssets.length,
    total_fetches: totalFetches,
    total_revocations: totalRevocations,
    assets_by_status: assetsByStatus,
    assets_by_type: assetsByType,
    top_assets: topAssets,
    period_start: thirtyDaysAgo,
    period_end: now.toISOString(),
  };

  res.json(stats);
}

/**
 * POST /a2a/asset/self-revoke
 * Owner can revoke their own asset
 * Requires nodeId and request body passed from route handler
 */
export function handleSelfRevoke(nodeId: string, reqBody: { asset_id?: string; reason?: string }, res: Response): void {
  if (!nodeId) {
    return badRequest(res, 'Authentication required');
  }

  const { asset_id } = reqBody;
  if (!asset_id) {
    return badRequest(res, 'asset_id is required');
  }

  const asset = getAsset(asset_id);
  if (!asset) {
    return notFound(res, `Asset ${asset_id} not found`);
  }

  if (asset.owner_id !== nodeId) {
    return forbidden(res, 'Only the asset owner can revoke this asset');
  }

  if (asset.status === 'archived' || asset.status === 'rejected') {
    return badRequest(res, `Asset is already ${asset.status}`);
  }

  // Update asset status
  updateAssetStatus(asset_id, 'rejected');

  addAuditEntry(asset_id, 'revoked', nodeId, 'node', {
    previous_status: asset.status,
    reason: reqBody.reason ?? 'self-revoke',
  });

  addTimelineEntry(
    asset_id,
    'asset_revoked',
    `Asset revoked by owner ${nodeId}`,
    nodeId,
    { reason: reqBody.reason ?? 'self-revoke' }
  );

  res.json({
    status: 'ok',
    asset_id,
    new_status: 'rejected',
    message: 'Asset successfully revoked',
  });
}

/**
 * POST /a2a/assets/:id/fork
 * Fork an asset (creates a branch entry)
 * Requires nodeId, assetId, and optional reason from route handler
 */
export function handleForkAsset(nodeId: string, assetId: string, forkReason: string, res: Response): void {
  if (!nodeId) {
    return badRequest(res, 'Authentication required');
  }

  const id = assetId;

  const asset = getAsset(id);
  if (!asset) {
    return notFound(res, `Asset ${id} not found`);
  }

  const newAssetId = `fork_${randomUUID().slice(0, 8)}_${id}`;

  const branchEntry: BranchEntry = {
    branch_id: newAssetId,
    asset_id: newAssetId,
    parent_asset_id: id,
    fork_reason: forkReason,
    owner_id: nodeId,
    status: 'active',
    created_at: new Date().toISOString(),
  };
  branchLog.push(branchEntry);

  addAuditEntry(id, 'forked', nodeId, 'node', {
    forked_asset_id: newAssetId,
    fork_reason: forkReason,
  });

  addTimelineEntry(
    id,
    'asset_forked',
    `Asset forked by ${nodeId}, new id: ${newAssetId}`,
    nodeId,
    { forked_asset_id: newAssetId, fork_reason: forkReason }
  );

  res.status(201).json({
    status: 'ok',
    original_asset_id: id,
    forked_asset_id: newAssetId,
    fork_reason: forkReason,
  });
}

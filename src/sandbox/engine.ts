/**
 * Evolution Sandbox Engine
 * Phase 2-3: Isolated evolution environment
 *
 * Supports:
 * - Soft-tagged (low isolation) vs Hard-isolated (high isolation) sandboxes
 * - Staging vs production asset separation
 * - Member management (Participant / Observer roles)
 * - Asset promotion pipeline (sandbox → production)
 */

import {
  EvolutionSandbox,
  SandboxMember,
  SandboxAsset,
  SandboxMetrics,
  PromotionRequest,
  SandboxInvite,
  SandboxRole,
  IsolationLevel,
  SandboxState,
  SANDBOX_DEFAULT_ISOLATION,
  SANDBOX_TAG_PREFIX,
} from './types';

// ============ In-Memory Stores ============
const sandboxes = new Map<string, EvolutionSandbox>();
const members = new Map<string, SandboxMember[]>();      // sandbox_id → members
const sandboxAssets = new Map<string, SandboxAsset[]>(); // sandbox_id → assets
const promotionRequests = new Map<string, PromotionRequest>();
const invites = new Map<string, SandboxInvite>();

// Index: node_id → sandbox_ids
const nodeSandboxIndex = new Map<string, Set<string>>();

// ============ Sandbox CRUD ============

export function createSandbox(input: {
  sandbox_id: string;
  name: string;
  description: string;
  isolation_level?: IsolationLevel;
  env?: 'staging' | 'production';
  created_by: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}): EvolutionSandbox {
  const now = new Date().toISOString();

  const sandbox: EvolutionSandbox = {
    sandbox_id: input.sandbox_id,
    name: input.name,
    description: input.description,
    isolation_level: input.isolation_level ?? SANDBOX_DEFAULT_ISOLATION,
    env: input.env ?? 'staging',
    state: 'active',
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
    tags: input.tags ?? [],
    member_count: 1,
    total_assets: 0,
    total_promoted: 0,
    avg_gdi: 0,
    metadata: input.metadata,
  };

  sandboxes.set(sandbox.sandbox_id, sandbox);
  members.set(sandbox.sandbox_id, []);

  // Auto-add creator as participant
  addMember(sandbox.sandbox_id, input.created_by, 'participant');

  // Index
  if (!nodeSandboxIndex.has(input.created_by)) {
    nodeSandboxIndex.set(input.created_by, new Set());
  }
  nodeSandboxIndex.get(input.created_by)!.add(sandbox.sandbox_id);

  return sandbox;
}

export function getSandbox(sandboxId: string): EvolutionSandbox | undefined {
  return sandboxes.get(sandboxId);
}

export function updateSandboxState(sandboxId: string, state: SandboxState): EvolutionSandbox | undefined {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) return undefined;
  sandbox.state = state;
  sandbox.updated_at = new Date().toISOString();
  return sandbox;
}

export function listSandboxes(filter?: {
  state?: SandboxState;
  env?: 'staging' | 'production';
  isolation_level?: IsolationLevel;
  created_by?: string;
  tag?: string;
}): EvolutionSandbox[] {
  let result = [...sandboxes.values()];
  if (filter?.state) result = result.filter(s => s.state === filter.state);
  if (filter?.env) result = result.filter(s => s.env === filter.env);
  if (filter?.isolation_level) result = result.filter(s => s.isolation_level === filter.isolation_level);
  if (filter?.created_by) result = result.filter(s => s.created_by === filter.created_by);
  if (filter?.tag) result = result.filter(s => s.tags.includes(filter.tag!));
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ============ Member Management ============

export function addMember(
  sandboxId: string,
  nodeId: string,
  role: SandboxRole
): SandboxMember | undefined {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) return undefined;

  const sandboxMembers = members.get(sandboxId) ?? [];

  // Check if already member
  const existing = sandboxMembers.find(m => m.node_id === nodeId);
  if (existing) {
    existing.role = role;
    existing.last_activity_at = new Date().toISOString();
    return existing;
  }

  const member: SandboxMember = {
    sandbox_id: sandboxId,
    node_id: nodeId,
    role,
    joined_at: new Date().toISOString(),
    assets_created: 0,
    assets_promoted: 0,
    last_activity_at: new Date().toISOString(),
  };

  sandboxMembers.push(member);
  members.set(sandboxId, sandboxMembers);
  sandbox.member_count = sandboxMembers.length;

  // Index
  if (!nodeSandboxIndex.has(nodeId)) {
    nodeSandboxIndex.set(nodeId, new Set());
  }
  nodeSandboxIndex.get(nodeId)!.add(sandboxId);

  return member;
}

export function getMember(sandboxId: string, nodeId: string): SandboxMember | undefined {
  return members.get(sandboxId)?.find(m => m.node_id === nodeId);
}

export function listMembers(sandboxId: string): SandboxMember[] {
  return members.get(sandboxId) ?? [];
}

export function getSandboxesForNode(nodeId: string): EvolutionSandbox[] {
  const ids = nodeSandboxIndex.get(nodeId);
  if (!ids) return [];
  return [...ids].map(id => sandboxes.get(id)).filter(Boolean) as EvolutionSandbox[];
}

export function updateMemberRole(
  sandboxId: string,
  nodeId: string,
  role: SandboxRole
): SandboxMember | undefined {
  const member = getMember(sandboxId, nodeId);
  if (!member) return undefined;
  member.role = role;
  member.last_activity_at = new Date().toISOString();
  return member;
}

// ============ Sandbox Assets ============

export function addSandboxAsset(asset: Omit<SandboxAsset, 'sandbox_id' | 'created_at' | 'promoted'> & { sandbox_id: string }): SandboxAsset {
  const now = new Date().toISOString();

  const sa: SandboxAsset = {
    ...asset,
    sandbox_id: asset.sandbox_id,
    created_at: now,
    promoted: false,
  };

  const assets = sandboxAssets.get(asset.sandbox_id) ?? [];
  assets.push(sa);
  sandboxAssets.set(asset.sandbox_id, assets);

  // Update sandbox metrics
  const sandbox = sandboxes.get(asset.sandbox_id);
  if (sandbox) {
    sandbox.total_assets = assets.length;
    sandbox.avg_gdi = assets.reduce((sum, a) => sum + (a.gdi ?? 0), 0) / (assets.length || 1);

    // Update member stats
    const member = getMember(asset.sandbox_id, asset.created_by);
    if (member) {
      member.assets_created += 1;
      member.last_activity_at = now;
    }
  }

  return sa;
}

export function getSandboxAssets(sandboxId: string, filter?: {
  promoted?: boolean;
  asset_type?: 'gene' | 'capsule';
  created_by?: string;
  min_gdi?: number;
}): SandboxAsset[] {
  const assets = sandboxAssets.get(sandboxId) ?? [];
  let result = [...assets];
  if (filter?.promoted !== undefined) result = result.filter(a => a.promoted === filter.promoted);
  if (filter?.asset_type) result = result.filter(a => a.asset_type === filter.asset_type);
  if (filter?.created_by) result = result.filter(a => a.created_by === filter.created_by);
  if (filter?.min_gdi !== undefined) result = result.filter(a => (a.gdi ?? 0) >= filter.min_gdi!);
  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getSandboxAsset(sandboxId: string, assetId: string): SandboxAsset | undefined {
  return sandboxAssets.get(sandboxId)?.find(a => a.asset_id === assetId);
}

export function promoteAsset(sandboxId: string, assetId: string, reviewedBy: string): SandboxAsset | undefined {
  const assets = sandboxAssets.get(sandboxId);
  if (!assets) return undefined;
  const asset = assets.find(a => a.asset_id === assetId);
  if (!asset) return undefined;

  asset.promoted = true;
  asset.promoted_at = new Date().toISOString();

  const sandbox = sandboxes.get(sandboxId);
  if (sandbox) {
    sandbox.total_promoted += 1;

    const member = getMember(sandboxId, asset.created_by);
    if (member) {
      member.assets_promoted += 1;
    }
  }

  return asset;
}

// ============ Promotion Requests ============

export function requestPromotion(input: {
  sandbox_id: string;
  asset_id: string;
  requested_by: string;
}): PromotionRequest {
  const req: PromotionRequest = {
    request_id: `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sandbox_id: input.sandbox_id,
    asset_id: input.asset_id,
    requested_by: input.requested_by,
    requested_at: new Date().toISOString(),
    status: 'pending',
  };
  promotionRequests.set(req.request_id, req);
  return req;
}

export function getPromotionRequests(sandboxId: string, status?: 'pending' | 'approved' | 'rejected'): PromotionRequest[] {
  const all = [...promotionRequests.values()].filter(r => r.sandbox_id === sandboxId);
  if (status) return all.filter(r => r.status === status);
  return all;
}

export function reviewPromotion(
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewer: string,
  note?: string
): PromotionRequest | undefined {
  const req = promotionRequests.get(requestId);
  if (!req || req.status !== 'pending') return undefined;

  req.status = decision;
  req.reviewed_by = reviewer;
  req.reviewed_at = new Date().toISOString();
  req.review_note = note;

  if (decision === 'approved') {
    promoteAsset(req.sandbox_id, req.asset_id, reviewer);
  }

  return req;
}

// ============ Sandbox Metrics ============

export function getSandboxMetrics(sandboxId: string): SandboxMetrics | undefined {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) return undefined;

  const assets = sandboxAssets.get(sandboxId) ?? [];
  const pendingPromotions = [...promotionRequests.values()].filter(
    r => r.sandbox_id === sandboxId && r.status === 'pending'
  ).length;

  return {
    sandbox_id: sandboxId,
    timestamp: new Date().toISOString(),
    nodes: sandbox.member_count,
    assets: sandbox.total_assets,
    promoted: sandbox.total_promoted,
    avg_gdi: Math.round(sandbox.avg_gdi * 100) / 100,
    pending_promotions: pendingPromotions,
  };
}

// ============ Hard Isolation Check ============

/**
 * Check if an asset is visible outside a hard-isolated sandbox
 * Returns true if the asset should be hidden from the outside world
 */
export function isAssetHiddenInSandbox(sandboxId: string, assetId: string): boolean {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) return false;
  if (sandbox.isolation_level === 'hard') {
    const asset = getSandboxAsset(sandboxId, assetId);
    return !!asset && !asset.promoted;
  }
  return false;
}

/**
 * Filter assets for a hard-isolated sandbox (only show promoted or untagged)
 */
export function filterAssetsForSandbox(
  sandboxId: string,
  assets: SandboxAsset[]
): SandboxAsset[] {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox || sandbox.isolation_level === 'soft') {
    return assets;
  }
  // Hard isolation: only return promoted assets
  return assets.filter(a => a.promoted);
}

// ============ Invites ============

export function createInvite(input: {
  sandbox_id: string;
  inviter: string;
  invitee: string;
  role?: SandboxRole;
}): SandboxInvite {
  const invite: SandboxInvite = {
    invite_id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sandbox_id: input.sandbox_id,
    inviter: input.inviter,
    invitee: input.invitee,
    role: input.role ?? 'participant',
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  invites.set(invite.invite_id, invite);
  return invite;
}

export function acceptInvite(inviteId: string): SandboxInvite | undefined {
  const invite = invites.get(inviteId);
  if (!invite || invite.status !== 'pending') return undefined;
  invite.status = 'accepted';
  addMember(invite.sandbox_id, invite.invitee, invite.role);
  return invite;
}

export function declineInvite(inviteId: string): SandboxInvite | undefined {
  const invite = invites.get(inviteId);
  if (!invite || invite.status !== 'pending') return undefined;
  invite.status = 'declined';
  return invite;
}

export function getInvite(inviteId: string): SandboxInvite | undefined {
  return invites.get(inviteId);
}

export function getPendingInvitesForNode(nodeId: string): SandboxInvite[] {
  return [...invites.values()].filter(i => i.invitee === nodeId && i.status === 'pending');
}

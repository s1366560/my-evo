// Sandbox service - provides sandbox management capabilities
// This is a stub implementation - full implementation would connect to a sandbox runtime

export interface Sandbox {
  sandbox_id: string;
  name: string;
  description: string;
  state: 'pending' | 'running' | 'completed' | 'failed';
  isolation_level?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface SandboxMember {
  member_id: string;
  sandbox_id: string;
  node_id: string;
  role: string;
  joined_at: Date;
}

export interface SandboxAsset {
  asset_id: string;
  sandbox_id: string;
  asset_type: string;
  name: string;
  content: string;
  signals_match?: string[];
  strategy?: string[];
  tags?: string[];
  created_at: Date;
}

// In-memory storage for sandboxes (replace with database in production)
const sandboxes = new Map<string, Sandbox>();
const members = new Map<string, SandboxMember[]>();
const assets = new Map<string, SandboxAsset[]>();

export async function listSandboxes(
  state?: string,
  isolationLevel?: string,
  limit = 20,
  offset = 0,
  nodeId?: string
): Promise<{ items: Sandbox[]; total: number }> {
  let items = Array.from(sandboxes.values());
  
  if (nodeId) {
    items = items.filter(s => s.created_by === nodeId);
  }
  
  if (state) {
    items = items.filter(s => s.state === state);
  }
  
  const total = items.length;
  return { items: items.slice(offset, offset + limit), total };
}

export async function getSandbox(sandboxId: string, nodeId?: string): Promise<Sandbox | null> {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) return null;
  if (nodeId && sandbox.created_by !== nodeId) {
    // Check if user is a member
    const sandboxMembers = members.get(sandboxId) || [];
    if (!sandboxMembers.some(m => m.node_id === nodeId)) {
      return null;
    }
  }
  return sandbox;
}

export async function getSandboxStats(): Promise<{
  total: number;
  active: number;
  completed: number;
}> {
  const items = Array.from(sandboxes.values());
  return {
    total: items.length,
    active: items.filter(s => s.state === 'running' || s.state === 'pending').length,
    completed: items.filter(s => s.state === 'completed').length,
  };
}

export async function createSandbox(
  nodeId: string,
  name: string,
  description: string,
  isolationLevel?: string,
  _env?: string,
  tags?: string[],
  metadata?: Record<string, unknown>
): Promise<Sandbox> {
  const sandbox: Sandbox = {
    sandbox_id: `sbx_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    name,
    description,
    state: 'pending',
    isolation_level: isolationLevel,
    created_by: nodeId,
    created_at: new Date(),
    updated_at: new Date(),
  };
  sandboxes.set(sandbox.sandbox_id, sandbox);
  members.set(sandbox.sandbox_id, []);
  assets.set(sandbox.sandbox_id, []);
  return sandbox;
}

export async function updateSandbox(
  sandboxId: string,
  nodeId: string,
  updates: Partial<Sandbox>
): Promise<Sandbox | null> {
  const sandbox = await getSandbox(sandboxId, nodeId);
  if (!sandbox) return null;
  
  const updated = { ...sandbox, ...updates, updated_at: new Date() };
  sandboxes.set(sandboxId, updated);
  return updated;
}

export async function deleteSandbox(sandboxId: string, nodeId: string): Promise<boolean> {
  const sandbox = await getSandbox(sandboxId, nodeId);
  if (!sandbox) return false;
  
  sandboxes.delete(sandboxId);
  members.delete(sandboxId);
  assets.delete(sandboxId);
  return true;
}

export async function joinSandbox(sandboxId: string, nodeId: string): Promise<SandboxMember> {
  const sandbox = sandboxes.get(sandboxId);
  if (!sandbox) throw new Error('Sandbox not found');
  
  const member: SandboxMember = {
    member_id: `mem_${Date.now()}`,
    sandbox_id: sandboxId,
    node_id: nodeId,
    role: 'participant',
    joined_at: new Date(),
  };
  
  const existingMembers = members.get(sandboxId) || [];
  existingMembers.push(member);
  members.set(sandboxId, existingMembers);
  
  return member;
}

export async function leaveSandbox(sandboxId: string, nodeId: string): Promise<boolean> {
  const existingMembers = members.get(sandboxId) || [];
  const filtered = existingMembers.filter(m => m.node_id !== nodeId);
  members.set(sandboxId, filtered);
  return filtered.length !== existingMembers.length;
}

export async function listMembers(sandboxId: string, _nodeId?: string): Promise<SandboxMember[]> {
  return members.get(sandboxId) || [];
}

export async function inviteMember(
  sandboxId: string,
  _nodeId: string,
  invitee: string,
  role?: string
): Promise<{ invite_id: string; invitee: string; role: string }> {
  return {
    invite_id: `inv_${Date.now()}`,
    invitee,
    role: role || 'participant',
  };
}

export async function listAssets(sandboxId: string, _nodeId?: string): Promise<SandboxAsset[]> {
  return assets.get(sandboxId) || [];
}

export async function addAsset(
  sandboxId: string,
  _nodeId: string,
  assetData: Omit<SandboxAsset, 'created_at' | 'sandbox_id'>
): Promise<SandboxAsset> {
  const asset: SandboxAsset = {
    ...assetData,
    sandbox_id: sandboxId,
    created_at: new Date(),
  };
  
  const existingAssets = assets.get(sandboxId) || [];
  existingAssets.push(asset);
  assets.set(sandboxId, existingAssets);
  
  return asset;
}

export async function attachExistingAssetToSandbox(
  sandboxId: string,
  _nodeId: string,
  _assetId: string
): Promise<{ success: boolean }> {
  return { success: true };
}

export async function runExperiment(
  sandboxId: string,
  _nodeId: string,
  _experiment: { experiment_type?: string; target_gene?: string; mutation_strategy?: string; parameters?: Record<string, unknown> }
): Promise<{ experiment_id: string; status: string }> {
  return {
    experiment_id: `exp_${Date.now()}`,
    status: 'completed',
  };
}

export async function modifySandboxAsset(
  sandboxId: string,
  _nodeId: string,
  _assetId: string,
  _modifications: Record<string, unknown>
): Promise<{ success: boolean }> {
  return { success: true };
}

export async function completeSandbox(
  sandboxId: string,
  _nodeId: string,
  _options?: { promote_assets?: string[]; summary?: string }
): Promise<{ success: boolean; sandbox_id: string }> {
  const sandbox = sandboxes.get(sandboxId);
  if (sandbox) {
    sandbox.state = 'completed';
    sandbox.updated_at = new Date();
    sandboxes.set(sandboxId, sandbox);
  }
  return { success: true, sandbox_id: sandboxId };
}

export async function compareSandbox(
  sandboxId: string,
  _nodeId: string
): Promise<{ sandbox_id: string; total_assets: number; isolation_mode: string }> {
  const sandboxAssets = assets.get(sandboxId) || [];
  const sandbox = sandboxes.get(sandboxId);
  return {
    sandbox_id: sandboxId,
    total_assets: sandboxAssets.length,
    isolation_mode: sandbox?.isolation_level || 'soft-tagged',
  };
}

export async function requestPromotion(
  sandboxId: string,
  _nodeId: string,
  _assetId: string
): Promise<{ promotion_id: string; status: string }> {
  return {
    promotion_id: `promo_${Date.now()}`,
    status: 'pending',
  };
}

export async function listPromotions(sandboxId: string, _nodeId: string): Promise<Array<{ promotion_id: string; status: string }>> {
  return [];
}

export async function approvePromotion(
  sandboxId: string,
  requestId: string,
  _nodeId: string
): Promise<{ success: boolean; promotion_id: string }> {
  return { success: true, promotion_id: requestId };
}

export async function rejectPromotion(
  sandboxId: string,
  requestId: string,
  _nodeId: string,
  _note: string
): Promise<{ success: boolean; promotion_id: string }> {
  return { success: true, promotion_id: requestId };
}

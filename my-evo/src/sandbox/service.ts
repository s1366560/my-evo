/**
 * Evolution Sandbox Service
 * 
 * Isolated environment for controlled gene/capsule experiments.
 * Provides staging environment separation from production assets.
 */

import { randomUUID } from 'crypto';

// Sandbox modes
export type SandboxMode = 'soft-tagged' | 'hard-isolated';

// Participant roles
export type SandboxRole = 'participant' | 'observer';

// Sandbox status
export type SandboxStatus = 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';

// Environment fingerprint
export interface EnvFingerprint {
  platform: string;
  runtime: string;
  version: string;
  capabilities: string[];
}

// Sandbox instance
export interface Sandbox {
  id: string;
  name: string;
  mode: SandboxMode;
  status: SandboxStatus;
  created_by: string;
  created_at: number;
  expires_at: number;
  env_fingerprint: EnvFingerprint;
  assets: SandboxAsset[];
  experiments: Experiment[];
  participants: Participant[];
  results?: ExperimentResults;
}

// Sandbox asset (isolated copy)
export interface SandboxAsset {
  asset_id: string;
  type: 'Gene' | 'Capsule';
  original_id: string;
  sandboxed_content: unknown;
  modifications: AssetModification[];
}

// Asset modification tracking
export interface AssetModification {
  field: string;
  old_value: unknown;
  new_value: unknown;
  timestamp: number;
  modified_by: string;
}

// Experiment run
export interface Experiment {
  id: string;
  name: string;
  description: string;
  genes: string[];
  capsules: string[];
  config: ExperimentConfig;
  status: SandboxStatus;
  started_at?: number;
  completed_at?: number;
  logs: ExperimentLog[];
}

// Experiment configuration
export interface ExperimentConfig {
  iterations: number;
  timeout_ms: number;
  validation_mode: 'strict' | 'relaxed';
  track_mutations: boolean;
  expected_outcome?: Record<string, unknown>;
}

// Experiment log
export interface ExperimentLog {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: unknown;
}

// Participant in sandbox
export interface Participant {
  node_id: string;
  role: SandboxRole;
  joined_at: number;
  contributions: number;
}

// Experiment results
export interface ExperimentResults {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  avg_score: number;
  mutations_found: number;
  recommendations: string[];
}

// In-memory store
const sandboxes: Map<string, Sandbox> = new Map();

/**
 * Create a new Evolution Sandbox
 */
export function createSandbox(params: {
  name: string;
  mode: SandboxMode;
  created_by: string;
  env_fingerprint: EnvFingerprint;
  participants?: string[];
  ttl_hours?: number;
}): Sandbox {
  const id = `sandbox_${randomUUID().slice(0, 8)}`;
  const now = Date.now();
  const ttlHours = params.ttl_hours || 24;
  
  const sandbox: Sandbox = {
    id,
    name: params.name,
    mode: params.mode,
    status: 'pending',
    created_by: params.created_by,
    created_at: now,
    expires_at: now + (ttlHours * 60 * 60 * 1000),
    env_fingerprint: params.env_fingerprint,
    assets: [],
    experiments: [],
    participants: (params.participants || []).map(node_id => ({
      node_id,
      role: 'participant' as SandboxRole,
      joined_at: now,
      contributions: 0,
    })),
  };
  
  sandboxes.set(id, sandbox);
  return sandbox;
}

/**
 * Add asset to sandbox (creates isolated copy)
 */
export function addAssetToSandbox(params: {
  sandbox_id: string;
  asset_id: string;
  type: 'Gene' | 'Capsule';
  original_id: string;
  sandboxed_content: unknown;
}): SandboxAsset | null {
  const sandbox = sandboxes.get(params.sandbox_id);
  if (!sandbox) return null;
  
  const asset: SandboxAsset = {
    asset_id: params.asset_id,
    type: params.type,
    original_id: params.original_id,
    sandboxed_content: params.sandboxed_content,
    modifications: [],
  };
  
  sandbox.assets.push(asset);
  return asset;
}

/**
 * Modify asset in sandbox (tracks changes)
 */
export function modifyAsset(params: {
  sandbox_id: string;
  asset_id: string;
  field: string;
  new_value: unknown;
  modified_by: string;
}): boolean {
  const sandbox = sandboxes.get(params.sandbox_id);
  if (!sandbox) return false;
  
  const asset = sandbox.assets.find(a => a.asset_id === params.asset_id);
  if (!asset) return false;
  
  const oldValue = (asset.sandboxed_content as Record<string, unknown>)[params.field];
  
  asset.modifications.push({
    field: params.field,
    old_value: oldValue,
    new_value: params.new_value,
    timestamp: Date.now(),
    modified_by: params.modified_by,
  });
  
  (asset.sandboxed_content as Record<string, unknown>)[params.field] = params.new_value;
  return true;
}

/**
 * Run experiment in sandbox
 */
export function runExperiment(params: {
  sandbox_id: string;
  name: string;
  description: string;
  genes: string[];
  capsules: string[];
  config: ExperimentConfig;
}): Experiment | null {
  const sandbox = sandboxes.get(params.sandbox_id);
  if (!sandbox) return null;
  
  const experiment: Experiment = {
    id: `exp_${randomUUID().slice(0, 8)}`,
    name: params.name,
    description: params.description,
    genes: params.genes,
    capsules: params.capsules,
    config: params.config,
    status: 'running',
    started_at: Date.now(),
    logs: [{
      timestamp: Date.now(),
      level: 'info',
      message: `Experiment started: ${params.name}`,
    }],
  };
  
  sandbox.experiments.push(experiment);
  sandbox.status = 'running';
  
  return experiment;
}

/**
 * Complete experiment
 */
export function completeExperiment(params: {
  sandbox_id: string;
  experiment_id: string;
  success: boolean;
  score: number;
  mutations_found: number;
  recommendations: string[];
}): boolean {
  const sandbox = sandboxes.get(params.sandbox_id);
  if (!sandbox) return false;
  
  const experiment = sandbox.experiments.find(e => e.id === params.experiment_id);
  if (!experiment) return false;
  
  experiment.status = params.success ? 'completed' : 'failed';
  experiment.completed_at = Date.now();
  experiment.logs.push({
    timestamp: Date.now(),
    level: params.success ? 'info' : 'error',
    message: `Experiment ${params.success ? 'completed' : 'failed'} with score ${params.score}`,
  });
  
  // Calculate results
  sandbox.results = {
    total_runs: sandbox.experiments.length,
    successful_runs: sandbox.experiments.filter(e => e.status === 'completed').length,
    failed_runs: sandbox.experiments.filter(e => e.status === 'failed').length,
    avg_score: sandbox.experiments.reduce((sum, e) => sum + (e.config.iterations || 0), 0) / sandbox.experiments.length,
    mutations_found: sandbox.results?.mutations_found || 0,
    recommendations: params.recommendations,
  };
  
  return true;
}

/**
 * Get sandbox by ID
 */
export function getSandbox(sandbox_id: string): Sandbox | null {
  return sandboxes.get(sandbox_id) || null;
}

/**
 * List all sandboxes (with optional filter)
 */
export function listSandboxes(filter?: {
  status?: SandboxStatus;
  mode?: SandboxMode;
  created_by?: string;
}): Sandbox[] {
  let result = Array.from(sandboxes.values());
  
  if (filter?.status) {
    result = result.filter(s => s.status === filter.status);
  }
  if (filter?.mode) {
    result = result.filter(s => s.mode === filter.mode);
  }
  if (filter?.created_by) {
    result = result.filter(s => s.created_by === filter.created_by);
  }
  
  return result.sort((a, b) => b.created_at - a.created_at);
}

/**
 * Cancel sandbox
 */
export function cancelSandbox(sandbox_id: string): boolean {
  const sandbox = sandboxes.get(sandbox_id);
  if (!sandbox) return false;
  
  sandbox.status = 'cancelled';
  sandbox.experiments.forEach(exp => {
    if (exp.status === 'running') {
      exp.status = 'cancelled';
    }
  });
  
  return true;
}

/**
 * Add participant to sandbox
 */
export function addParticipant(params: {
  sandbox_id: string;
  node_id: string;
  role?: SandboxRole;
}): boolean {
  const sandbox = sandboxes.get(params.sandbox_id);
  if (!sandbox) return false;
  
  const existing = sandbox.participants.find(p => p.node_id === params.node_id);
  if (existing) return false;
  
  sandbox.participants.push({
    node_id: params.node_id,
    role: params.role || 'participant',
    joined_at: Date.now(),
    contributions: 0,
  });
  
  return true;
}

/**
 * Get sandbox statistics
 */
export function getSandboxStats(): {
  total: number;
  by_status: Record<SandboxStatus, number>;
  by_mode: Record<SandboxMode, number>;
  total_experiments: number;
} {
  const all = Array.from(sandboxes.values());
  
  const by_status: Record<SandboxStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
  };
  
  const by_mode: Record<SandboxMode, number> = {
    'soft-tagged': 0,
    'hard-isolated': 0,
  };
  
  let total_experiments = 0;
  
  all.forEach(s => {
    by_status[s.status]++;
    by_mode[s.mode]++;
    total_experiments += s.experiments.length;
  });
  
  return { total: all.length, by_status, by_mode, total_experiments };
}

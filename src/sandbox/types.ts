/**
 * Evolution Sandbox Types
 * Phase 2-3: Isolated evolution environment for controlled gene/capsule experiments
 *
 * Features:
 * - Soft-tagged isolation (low) — assets tagged but globally visible
 * - Hard-isolated (high) — sandbox-only assets invisible outside
 * - Member roles: Participant (full), Observer (read-only)
 * - Staging environment separation from production assets
 */

// Isolation level for a sandbox
export type IsolationLevel = 'soft' | 'hard';

// Sandbox environment type
export type SandboxEnv = 'staging' | 'production';

// Sandbox membership role
export type SandboxRole = 'participant' | 'observer';

// Sandbox lifecycle state
export type SandboxState = 'active' | 'frozen' | 'archived';

// A sandbox environment
export interface EvolutionSandbox {
  sandbox_id: string;
  name: string;
  description: string;
  isolation_level: IsolationLevel;
  env: SandboxEnv;
  state: SandboxState;
  created_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];           // soft-tagged assets carry these tags
  member_count: number;
  total_assets: number;     // assets created in this sandbox
  total_promoted: number;  // assets promoted to production
  avg_gdi: number;         // average GDI of sandbox assets
  metadata?: Record<string, unknown>;
}

// Sandbox member
export interface SandboxMember {
  sandbox_id: string;
  node_id: string;
  role: SandboxRole;
  joined_at: string;
  assets_created: number;
  assets_promoted: number;
  last_activity_at: string;
}

// A sandbox asset (shadow copy of an asset in sandbox context)
export interface SandboxAsset {
  sandbox_id: string;
  asset_id: string;       // original asset_id
  asset_type: 'gene' | 'capsule';
  name: string;
  content: string;
  signals_match?: string[];
  strategy?: string[];
  diff?: string;
  trigger?: string[];
  gene?: string;
  confidence?: number;
  gdi?: number;
  tags: string[];         // sandbox-specific tags
  created_by: string;
  created_at: string;
  promoted: boolean;       // whether this asset was promoted to production
  promoted_at?: string;
  metadata?: Record<string, unknown>;
}

// Sandbox metrics snapshot
export interface SandboxMetrics {
  sandbox_id: string;
  timestamp: string;
  nodes: number;           // members in sandbox
  assets: number;          // total sandbox assets
  promoted: number;        // assets promoted
  avg_gdi: number;
  pending_promotions: number;
}

// Promotion request (sandbox → production)
export interface PromotionRequest {
  request_id: string;
  sandbox_id: string;
  asset_id: string;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
}

// Sandbox invitation
export interface SandboxInvite {
  invite_id: string;
  sandbox_id: string;
  inviter: string;
  invitee: string;
  role: SandboxRole;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

// Constants
export const SANDBOX_DEFAULT_ISOLATION: IsolationLevel = 'soft';
export const SANDBOX_TAG_PREFIX = 'sandbox:';

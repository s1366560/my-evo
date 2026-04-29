import { Endpoints } from './endpoints';
import { handleResponse, EvoMapError } from './http-client';
import { GDIStructured } from './normalizers';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';

class ApiClient {
  private buildUrl(path: string): string {
    // If path is absolute (starts with /), prepend BASE_URL
    if (path.startsWith('/')) {
      return `${BASE_URL}${path}`;
    }
    return path;
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      // Auth store persists under 'auth-storage' (zustand default)
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.token ?? null;
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    // Auto-attach JWT Bearer token from auth store
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const options: RequestInit = {
      credentials: 'include',
      headers,
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };
    const response = await fetch(url, options);
    return handleResponse<T>(response);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  // ── Typed endpoint helpers ─────────────────────────────────────────────────

  getStats() {
    return this.get<ApiStats>(Endpoints.a2a.stats);
  }

  getAssets(filters?: Parameters<typeof Endpoints.a2a.assetsWithFilters>[0]) {
    return this.get<{ items: Asset[] }>(
      Endpoints.a2a.assetsWithFilters(filters),
    ).then((r) => {
      if (!Array.isArray(r?.items)) {
        throw new EvoMapError(
          'Unexpected assets response shape — expected { items: Asset[] }',
          0,
          'INVALID_RESPONSE',
        );
      }
      return r.items;
    });
  }

  getAssetsRanked() {
    return this.get<Asset[]>(Endpoints.a2a.assetsRanked);
  }

  getTrending() {
    return this.get<Asset[]>(Endpoints.a2a.trending);
  }

  getAssetById(assetId: string) {
    return this.get<Asset>(Endpoints.a2a.assetById(assetId));
  }

  getAssetLineage(assetId: string) {
    return this.get<LineageResponse>(Endpoints.a2a.assetLineage(assetId));
  }

  searchAssets(q: string, page?: number) {
    return this.get<Asset[] | { data?: Asset[]; assets?: Asset[]; items?: Asset[] }>(
      Endpoints.assets.search(q, page)
    );
  }

  hello(body: HelloRequest) {
    return this.post<HelloResponse>(Endpoints.a2a.hello, body);
  }

  publish(body: PublishRequest) {
    return this.post<PublishResponse>(Endpoints.a2a.publish, body);
  }

  getSkills(q = '') {
    return this.get<Skill[]>(Endpoints.a2a.skillSearch(q));
  }

  getSkillCategories() {
    return this.get<SkillCategory[]>(Endpoints.a2a.skillCategories);
  }

  getSkillFeatured() {
    return this.get<Skill[]>(Endpoints.a2a.skillFeatured);
  }

  getCredits(nodeId: string) {
    return this.get<CreditsInfo>(Endpoints.a2a.credits(nodeId));
  }

  getReputation(nodeId: string) {
    return this.get<ReputationInfo>(Endpoints.a2a.reputation(nodeId));
  }

  getArenaSeasons() {
    return this.get<Season[]>(Endpoints.arena.seasons);
  }

  getArenaRankings(seasonId: string) {
    return this.get<ArenaRanking[]>(Endpoints.arena.rankings(seasonId));
  }

  getArenaMatches() {
    return this.get<{ items: ArenaMatch[]; meta: { total: number } }>(
      Endpoints.arena.matches,
    );
  }

  getSwarmTasks() {
    return this.get<{ swarms: Swarm[]; meta: { total: number; limit: number; offset: number } }>(Endpoints.swarm.all);
  }

  getCouncilProposals() {
    return this.get<{
      proposals: CouncilProposal[];
      meta: { total: number; limit: number; offset: number };
    }>(Endpoints.council.all);
  }

  getMarketplaceListings() {
    return this.get<MarketplaceListing[]>(Endpoints.marketplace.all);
  }

  castVote(proposalId: string, vote: "approve" | "reject" | "abstain") {
    return this.post<{ success: boolean }>(
      Endpoints.council.vote(proposalId),
      { vote }
    );
  }

  getBiologyPhylogeny(assetId: string) {
    return this.get<PhylogenyTree>(Endpoints.biology.phylogeny(assetId));
  }

  getBiologyFitness() {
    return this.get<FitnessLandscape>(Endpoints.biology.fitness);
  }

  getWorkerpool() {
    return this.get<{ workers: Worker[]; meta: { total: number; limit: number; offset: number } }>(Endpoints.workerpool.all);
  }

  getCreditsHistory(nodeId: string) {
    return this.get<{ items: CreditTransaction[]; meta: { total: number; page: number; limit: number } }>(Endpoints.a2a.creditsHistory(nodeId));
  }

  getReputationHistory(nodeId: string) {
    return this.get<{ items: ReputationEvent[]; meta: { total: number; page: number; limit: number } }>(Endpoints.a2a.reputationHistory(nodeId));
  }

  login(body: { email: string; password: string }) {
    return this.post<{ token: string; user: { id: string; email: string } }>(
      Endpoints.account.login,
      body,
    ).then((r) => {
      // Backend returns { success, data: { user, accessToken, refreshToken } }
      // Normalize to { token, user } expected by callers
      const data = r as unknown as { success?: boolean; data?: { user: { id: string; email: string }; accessToken: string } };
      if (data.data) {
        return { token: data.data.accessToken, user: data.data.user };
      }
      return r;
    });
  }

  register(body: { email: string; password: string }) {
    return this.post<{ message: string }>(Endpoints.account.register, body);
  }

  logout() {
    return this.post<{ success: boolean }>(Endpoints.account.logout);
  }

  getMe() {
    return this.get<{ user: { userId: string; email: string; role: string; iat: number; exp: number } }>(
      Endpoints.account.me,
    );
  }

  // ── Workspace API ────────────────────────────────────────────────────────────────

  /**
   * Get current workspace info
   */
  getCurrentWorkspace() {
    return this.get<WorkspaceInfo>('/api/v2/workspace/current');
  }

  /**
   * Get workspace members
   */
  getWorkspaceMembers() {
    return this.get<{ members: WorkspaceMember[]; total: number }>('/api/v2/workspace/members');
  }

  /**
   * Get workspace goals
   */
  getWorkspaceGoals() {
    return this.get<{ goals: WorkspaceGoal[]; total: number }>('/api/v2/workspace/goals');
  }

  /**
   * Get workspace tasks
   */
  getWorkspaceTasks() {
    return this.get<{ tasks: WorkspaceTask[]; total: number }>('/api/v2/workspace/tasks');
  }

  /**
   * Get workspace workers
   */
  getWorkspaceWorkers() {
    return this.get<{ workers: WorkspaceWorker[]; total: number }>('/api/v2/workspace/workers');
  }

  /**
   * Update workspace settings
   */
  updateWorkspaceSettings(settings: Partial<WorkspaceInfo['settings']>) {
    return this.patch<WorkspaceInfo['settings']>('/api/v2/workspace/settings', settings);
  }

  /**
   * Invite a member to the workspace
   */
  inviteWorkspaceMember(email: string, role: string = 'member') {
    return this.post<{
      id: string;
      workspaceId: string;
      email: string;
      role: string;
      status: string;
      expiresAt: string;
      createdAt: string;
    }>('/api/v2/workspace/invite', { email, role });
  }

  /**
   * Update a workspace task
   */
  updateWorkspaceTask(taskId: string, updates: Partial<WorkspaceTask>) {
    return this.patch<WorkspaceTask>(`/api/v2/workspace/tasks/${taskId}`, updates);
  }

  // ── Claim ─────────────────────────────────────────────────────────────────

  getClaimInfo(code: string) {
    return this.get<ClaimInfoResponse>(Endpoints.claim.getClaimInfo(code));
  }

  claimNode(code: string, body?: Record<string, unknown>) {
    return this.post<ClaimResponse>(Endpoints.claim.claimNode(code), body);
  }

  // ── Account agents ─────────────────────────────────────────────────────────

  getAccountAgents() {
    return this.get<AgentNodeInfo[]>(Endpoints.account.agents);
  }

  // ── Bounty API ────────────────────────────────────────────────────────────────

  getBounties(params?: { status?: BountyStatus; creator_id?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.creator_id) searchParams.set('creator_id', params.creator_id);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const qs = searchParams.toString();
    return this.get<{ success: boolean; bounties: Bounty[]; total: number; data: Bounty[] }>(
      `/api/v2/bounty/${qs ? `?${qs}` : ''}`,
    );
  }

  getOpenBounties() {
    return this.get<{ success: boolean; bounties: Bounty[]; total_open: number; total_reward_pool: number }>(
      '/api/v2/bounty/open',
    );
  }

  getBountyStats() {
    return this.get<BountyStats>('/api/v2/bounty/stats');
  }

  getBountyById(bountyId: string) {
    return this.get<{ success: boolean; bounty: Bounty; data: Bounty }>(
      `/api/v2/bounty/${bountyId}`,
    );
  }

  getMyBounties() {
    return this.get<{ success: boolean; bounties: Bounty[]; total: number; data: Bounty[] }>(
      '/api/v2/bounty/my',
    );
  }

  createBounty(body: {
    title: string;
    description: string;
    requirements?: string[];
    amount: number;
    deadline: string;
    milestones?: BountyMilestone[];
  }) {
    return this.post<{
      success: boolean;
      bounty_id: string;
      state: string;
      reward: number;
      created_at: string;
    }>('/api/v2/bounty/', body);
  }

  placeBid(bountyId: string, body: {
    proposedAmount: number;
    estimatedTime: string;
    approach: string;
  }) {
    return this.post<{ success: boolean; bid: BountyBid }>(
      `/api/v2/bounty/${bountyId}/bid`,
      body,
    );
  }

  submitBounty(bountyId: string, body: {
    content: string;
    attachments?: string[];
    milestone_id?: string;
  }) {
    return this.post<{
      success: boolean;
      bounty: Bounty;
      deliverable: BountyDeliverable;
    }>(`/api/v2/bounty/${bountyId}/submit`, body);
  }

  reviewBounty(bountyId: string, body: {
    accepted: boolean;
    comments?: string;
    milestone_id?: string;
  }) {
    return this.post<{ success: boolean; bounty: Bounty }>(
      `/api/v2/bounty/${bountyId}/review`,
      body,
    );
  }

  acceptBounty(bountyId: string, bidId: string) {
    return this.post<{ success: boolean; bounty: Bounty }>(
      `/api/v2/bounty/${bountyId}/accept-bid`,
      { bidId },
    );
  }

  cancelBounty(bountyId: string) {
    return this.post<{ success: boolean; bounty: Bounty }>(
      `/api/v2/bounty/${bountyId}/cancel`,
    );
  }

  // ── Dashboard API ─────────────────────────────────────────────────────────────

  /**
   * Get full dashboard data in one request.
   */
  getDashboard() {
    return this.get<DashboardData>('/api/v2/dashboard');
  }

  /**
   * Get user portion of dashboard.
   */
  getDashboardUser() {
    return this.get<DashboardUser>('/api/v2/dashboard/user');
  }

  /**
   * Get stats portion of dashboard.
   */
  getDashboardStats() {
    return this.get<DashboardStats>('/api/v2/dashboard/stats');
  }

  /**
   * Get recent assets portion of dashboard.
   */
  getDashboardAssets() {
    return this.get<DashboardAsset[]>('/api/v2/dashboard/assets');
  }

  /**
   * Get activity feed portion of dashboard.
   */
  getDashboardActivity() {
    return this.get<DashboardActivity[]>('/api/v2/dashboard/activity');
  }

  /**
   * Get trending signals for the dashboard.
   */
  getDashboardTrending() {
    return this.get<TrendingSignal[]>('/api/v2/dashboard/trending');
  }

  /**
   * Get credits portion of dashboard.
   */
  getDashboardCredits() {
    return this.get<DashboardCredits>('/api/v2/dashboard/credits');
  }
}

// ── Dashboard types (inline — mirrors lib/hooks/useDashboard.ts) ───────────────

export interface DashboardUser {
  id: string;
  username: string;
  email: string;
  node_id: string;
  reputation: number;
  trust_level: string;
  member_since: string;
}

export interface DashboardCredits {
  balance: number;
  pending: number;
  trend: 'up' | 'down' | 'flat';
  trend_percent: number;
}

export interface DashboardAsset {
  id: string;
  name: string;
  type: 'gene' | 'capsule' | 'recipe';
  gdi_score: number;
  calls: number;
  views: number;
  signals: string[];
  updated_at: string;
}

export interface DashboardActivity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface DashboardStats {
  total_assets: number;
  total_calls: number;
  total_views: number;
  today_calls: number;
  total_bounties_earned: number;
  active_bounties: number;
  swarm_sessions: number;
  completed_swarm_sessions: number;
}

export interface TrendingSignal {
  signal: string;
  count: number;
}

export interface DashboardData {
  user: DashboardUser;
  credits: DashboardCredits;
  stats: DashboardStats;
  recent_assets: DashboardAsset[];
  recent_activity: DashboardActivity[];
  trending_signals: TrendingSignal[];
}

// ── Claim types ───────────────────────────────────────────────────────────────

export interface ClaimInfoResponse {
  node_id: string;
  model: string;
  reputation: number;
  credit_balance: number;
  registered_at: string;
  status: 'available' | 'claimed';
}

export interface ClaimResponse {
  node_id: string;
  model: string;
  reputation: number;
}

export interface AgentNodeInfo {
  node_id: string;
  model: string;
  status: string;
  reputation: number;
  credit_balance: number;
  registered_at: string;
}

// ── Shared response types (mirrors backend shared/types.ts) ───────────────────

export interface ApiStats {
  total_nodes: number;
  alive_nodes: number;
  total_genes: number;
  total_capsules: number;
  total_recipes?: number;
  active_swarms?: number;
}

export type AssetType = 'Gene' | 'Capsule' | 'Recipe' | 'Organism';

export interface Asset {
  asset_id: string;
  name: string;
  type: AssetType;
  author_id: string;
  author_name?: string;
  gdi_score: number | GDIStructured;
  signals: string[];
  downloads?: number;
  description?: string;
  created_at: string;
  updated_at?: string;
  status?: string;
}

export interface LineageNode {
  asset_id: string;
  name: string;
  type: AssetType;
  parent_id?: string;
  gdi_score?: number;
}

export interface LineageResponse {
  nodes: LineageNode[];
  edges: { from: string; to: string }[];
}

export interface HelloRequest {
  node_name: string;
  capabilities?: string[];
  evo_version?: string;
}

export interface HelloResponse {
  your_node_id: string;
  node_secret: string;
  registered_at: string;
  status: string;
  credit_balance: number;
  trust_level: string;
  hub_node_id: string;
  claim_code?: string;
  claim_url?: string;
  referral_code?: string;
  heartbeat_interval_ms: number;
  heartbeat_endpoint: string;
  protocol: string;
  protocol_version: string;
}

export interface PublishRequest {
  name: string;
  type: AssetType;
  dna: string;
  description?: string;
  signals?: string[];
}

export interface PublishResponse {
  asset_id: string;
  status: string;
  created_at: string;
}

export interface Skill {
  skill_id: string;
  name: string;
  description: string;
  category: string;
  gdi_score?: number;
  downloads?: number;
  author?: string;
}

export interface SkillCategory {
  category: string;
  count: number;
}

export interface CreditsInfo {
  node_id: string;
  balance: number;
  updated_at: string;
}

export interface ReputationInfo {
  node_id: string;
  score: number;
  tier: string;
  trust: 'unverified' | 'verified' | 'trusted';
}

export interface ArenaRanking {
  node_id: string;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
  matches_played: number;
  rank: number;
  node_name?: string;
  gdi_score?: number;
}

export type Season = {
  season_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "upcoming";
  total_participants?: number;
};

export interface ArenaMatch {
  match_id: string;
  season_id: string;
  challenger_id: string;
  challenger_name?: string;
  defender_id: string;
  defender_name?: string;
  challenger_score?: number;
  defender_score?: number;
  winner_id?: string;
  status: "pending" | "completed" | "disputed";
  created_at: string;
}

export interface Swarm {
  swarm_id: string;
  name: string;
  mode: string;
  status: 'active' | 'completed' | 'failed';
  participant_count: number;
  created_at: string;
  progress?: number;
}

export interface CouncilProposal {
  proposal_id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votes_for: number;
  votes_against: number;
  created_at: string;
  author?: string;
}

export interface MarketplaceListing {
  listing_id: string;
  asset_id: string;
  asset_name: string;
  asset_type: 'Gene' | 'Capsule' | 'Recipe';
  price: number;
  seller: string;
  gdi_score?: number;
  created_at: string;
}

export interface PhylogenyNode {
  asset_id: string;
  name: string;
  type: AssetType;
  parent_id?: string;
  gdi_score?: number;
}

export interface PhylogenyTree {
  nodes: PhylogenyNode[];
  edges: { from: string; to: string }[];
  root_id?: string;
}

export interface FitnessCell {
  row: number;
  col: number;
  label: string;
  count: number;
  avg_gdi: number;
}

export interface FitnessLandscape {
  grid_size: number;
  grid: FitnessCell[][];
  x_axis_label: string;
  y_axis_label: string;
}

export interface Worker {
  node_id: string;
  name: string;
  expertise: string[];
  rating: number;
  completed_tasks: number;
  availability: 'available' | 'busy';
  hourly_rate: number;
}

export interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  created_at: string;
  description?: string;
}

export interface ReputationEvent {
  id: string;
  event_type: string;
  delta: number;
  score_after: number;
  created_at: string;
  description?: string;
}

// ── Workspace types ─────────────────────────────────────────────────────────────────

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  plan: string;
  settings: {
    defaultTrustLevel: string;
    bountyEnabled: boolean;
    councilEnabled: boolean;
    publicProfile: boolean;
    allowGuestBounties: boolean;
  };
  memberCount: number;
  reputation: number;
  credits: number;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  displayName: string;
  avatar: string | null;
}

export interface WorkspaceGoal {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'active' | 'completed' | 'pending';
  childTasks: string[];
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  taskId: string;
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'failed' | 'blocked';
  progressPct: number;
  assignedWorkerId?: string;
  role?: string;
  dependencies: string[];
  preflightChecks?: PreflightCheckResult[];
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PreflightCheckResult {
  check_id: string;
  kind: string;
  status: 'passed' | 'failed' | 'skipped';
}

export interface WorkspaceWorker {
  id: string;
  name: string;
  role: 'builder' | 'verifier' | 'architect' | 'specialist';
  status: 'idle' | 'in_progress' | 'assigned';
  assignedTasks: string[];
  joinedAt: string;
}

// ── Bounty types ─────────────────────────────────────────────────────────────────

export type BountyStatus = 'open' | 'claimed' | 'submitted' | 'accepted' | 'disputed' | 'resolved' | 'expired' | 'cancelled';

export interface Bounty {
  bounty_id: string;
  title: string;
  description: string;
  requirements: string[];
  amount: number;
  status: BountyStatus;
  creator_id: string;
  creator_name?: string;
  deadline: string;
  created_at: string;
  claimed_by?: string;
  claimed_by_name?: string;
  submissions_count?: number;
  milestones?: BountyMilestone[];
}

export interface BountyMilestone {
  milestone_id: string;
  title: string;
  description: string;
  percentage: number;
  status: 'pending' | 'in_progress' | 'completed' | 'verified';
}

export interface BountyBid {
  bid_id: string;
  bounty_id: string;
  bidder_id: string;
  bidder_name?: string;
  proposed_amount: number;
  estimated_time: string;
  approach: string;
  created_at: string;
}

export interface BountyDeliverable {
  deliverable_id: string;
  bounty_id: string;
  worker_id: string;
  content: string;
  attachments: string[];
  submitted_at: string;
  milestone_id?: string;
}

export interface BountyStats {
  total_bounties: number;
  open: number;
  in_progress: number;
  completed: number;
  expired: number;
  total_reward_pool?: number;
}

// Re-export error class for consumers
export { EvoMapError };

// Singleton instance
export const apiClient = new ApiClient();

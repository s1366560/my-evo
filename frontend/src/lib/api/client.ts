import { Endpoints } from './endpoints';
import { handleResponse, EvoMapError } from './http-client';
import { GDIStructured } from './normalizers';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

class ApiClient {
  /**
   * Common options for all requests.
   * Phase 1: no Authorization header — auth is Phase 2b.
   * API Key is sent via httpOnly cookie (credentials: 'include').
   */
  private baseOptions(): RequestInit {
    return {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  private buildUrl(path: string): string {
    // If path is absolute (starts with /), prepend BASE_URL
    if (path.startsWith('/')) {
      return `${BASE_URL}${path}`;
    }
    return path;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = this.buildUrl(path);
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
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

  // ── Typed endpoint helpers ─────────────────────────────────────────────────

  getStats() {
    return this.get<ApiStats>(Endpoints.a2a.stats);
  }

  getAssets(filters?: Parameters<typeof Endpoints.a2a.assetsWithFilters>[0]) {
    return this.get<Asset[]>(
      Endpoints.a2a.assetsWithFilters(filters),
    );
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
    return this.get<Asset[]>(Endpoints.assets.search(q, page));
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
    );
  }

  register(body: { email: string; password: string }) {
    return this.post<{ message: string }>(Endpoints.account.register, body);
  }

  logout() {
    return this.post<{ success: boolean }>(Endpoints.account.logout);
  }

  getMe() {
    return this.get<{ node_id: string; auth_type: string; trust_level: string }>(
      Endpoints.account.me,
    );
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

// Re-export error class for consumers
export { EvoMapError };

// Singleton instance
export const apiClient = new ApiClient();

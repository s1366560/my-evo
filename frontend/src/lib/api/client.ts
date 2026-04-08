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
    const options: RequestInit = {
      ...this.baseOptions(),
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
    return this.get<AssetListResponse>(
      Endpoints.a2a.assetsWithFilters(filters),
    );
  }

  getAssetsRanked() {
    return this.get<AssetListResponse>(Endpoints.a2a.assetsRanked);
  }

  getTrending() {
    return this.get<TrendingResponse>(Endpoints.a2a.trending);
  }

  getAssetById(assetId: string) {
    return this.get<Asset>(Endpoints.a2a.assetById(assetId));
  }

  getAssetLineage(assetId: string) {
    return this.get<LineageResponse>(Endpoints.a2a.assetLineage(assetId));
  }

  searchAssets(q: string, page?: number) {
    return this.get<AssetListResponse>(Endpoints.assets.search(q, page));
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
    return this.get<Rankings>(Endpoints.arena.rankings(seasonId));
  }

  getSwarmTasks() {
    return this.get<{ swarms: Swarm[]; meta: { total: number; limit: number; offset: number } }>(Endpoints.swarm.all);
  }

  getCouncilProposals() {
    return this.get<{ proposals: CouncilProposal[]; meta: { total: number; limit: number; offset: number } }>(Endpoints.council.all);
  }

  getMarketplaceListings() {
    return this.get<MarketplaceListing[]>(Endpoints.marketplace.all);
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
    return this.get<{ items: CreditTransaction[]; meta: { total: number; page: number; limit: number } }>(Endpoints.credits.history(nodeId));
  }

  getReputationHistory(nodeId: string) {
    return this.get<{ items: ReputationEvent[]; meta: { total: number; page: number; limit: number } }>(Endpoints.reputation.history(nodeId));
  }
}

// ── Shared response types (mirrors backend shared/types.ts) ───────────────────

export interface ApiStats {
  total_nodes: number;
  alive_nodes: number;
  total_genes: number;
  total_capsules: number;
  total_recipes: number;
  active_swarms: number;
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

export interface AssetListResponse {
  assets: Asset[];
  meta: {
    total: number;
    page?: number;
    limit?: number;
  };
}

export interface TrendingResponse {
  assets: Asset[];
  meta: { period: string };
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

export interface Season {
  season_id: string;
  name: string;
  started_at: string;
  ended_at?: string;
  status: 'active' | 'completed' | 'upcoming';
  participants?: number;
}

export interface RankingEntry {
  rank: number;
  node_id: string;
  node_name?: string;
  score: number;
  wins?: number;
  losses?: number;
  gdi_score?: number;
}

export type Rankings = RankingEntry[];

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

export interface FitnessLandscape {
  data: Array<{ novelty: number; usefulness: number; rigor: number; gdi: number }>;
  clusters?: number;
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

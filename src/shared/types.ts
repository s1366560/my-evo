// ===== A2A Protocol =====
export interface A2AMessage {
  protocol: 'gep-a2a';
  protocol_version: '1.0.0';
  message_type: string;
  message_id: string;
  sender_id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type NodeStatus = 'registered' | 'alive' | 'offline' | 'dead';
export type TrustLevel = 'unverified' | 'verified' | 'trusted';

export interface NodeInfo {
  node_id: string;
  status: NodeStatus;
  model: string;
  gene_count: number;
  capsule_count: number;
  reputation: number;
  credit_balance: number;
  last_seen: string;
  registered_at: string;
  trust_level: TrustLevel;
}

export interface HelloPayload {
  model: string;
  gene_count?: number;
  capsule_count?: number;
  env_fingerprint?: {
    node_version: string;
    platform: string;
    arch: string;
  };
}

export interface HelloResponse {
  status: 'acknowledged';
  your_node_id: string;
  node_secret: string;
  credit_balance: number;
  trust_level: TrustLevel;
  hub_node_id: string;
  claim_code: string;
  claim_url: string;
  referral_code: string;
  heartbeat_interval_ms: number;
  heartbeat_endpoint: string;
}

export interface HeartbeatPayload {
  node_id: string;
  status: 'alive';
  stats?: {
    gene_count: number;
    capsule_count: number;
    uptime_hours: number;
  };
}

export interface HeartbeatResponse {
  status: 'ok';
  your_node_id: string;
  next_heartbeat_in_ms: number;
  network_stats: {
    total_nodes: number;
    alive_nodes: number;
    total_genes: number;
    total_capsules: number;
  };
}

// ===== Asset System =====
export type AssetType = 'gene' | 'capsule' | 'recipe';
export type AssetStatus = 'draft' | 'published' | 'promoted' | 'archived' | 'revoked';

export interface Gene {
  gene_id: string;
  name: string;
  description: string;
  content: string;
  signals: string[];
  author_id: string;
  status: AssetStatus;
  gdi_score: number;
  downloads: number;
  rating: number;
  created_at: string;
  updated_at: string;
  version: number;
  lineage: LineageInfo;
  carbon_cost: number;
}

export interface Capsule {
  capsule_id: string;
  name: string;
  description: string;
  genes: string[];
  config: Record<string, unknown>;
  signals: string[];
  author_id: string;
  status: AssetStatus;
  gdi_score: number;
  downloads: number;
  rating: number;
  created_at: string;
  updated_at: string;
  version: number;
  lineage: LineageInfo;
  carbon_cost: number;
}

export interface LineageInfo {
  parent_id?: string;
  generation: number;
  ancestors: string[];
  fork_count: number;
}

export interface EvolutionEvent {
  event_id: string;
  asset_id: string;
  event_type: 'created' | 'forked' | 'mutated' | 'promoted' | 'archived' | 'revoked';
  from_version: number;
  to_version: number;
  changes: string;
  actor_id: string;
  timestamp: string;
}

// ===== GDI Scoring =====
export interface GDIScore {
  asset_id: string;
  overall: number;
  gdi_mean: number;
  gdi_lower: number;
  dimensions: {
    intrinsic: number;
    usage_mean: number;
    usage_lower: number;
    social_mean: number;
    social_lower: number;
    freshness: number;
  };
  calculated_at: string;
}

export interface SimilarityResult {
  asset_id: string;
  compared_to: string;
  score: number;
  severity: 'low' | 'medium' | 'high';
  strategy: 'jaccard' | 'cosine' | 'levenshtein';
}

// ===== Reputation =====
export type ReputationTier =
  | 'newcomer'
  | 'contributor'
  | 'established'
  | 'respected'
  | 'authority'
  | 'legend';

export interface ReputationScore {
  node_id: string;
  score: number;
  tier: ReputationTier;
  history: ReputationEvent[];
  calculated_at: string;
}

export interface ReputationEvent {
  event_type: string;
  delta: number;
  reason: string;
  timestamp: string;
}

// ===== Credits =====
export interface CreditBalance {
  node_id: string;
  available: number;
  locked: number;
  total: number;
  lifetime_earned: number;
  lifetime_spent: number;
}

export type CreditTransactionType =
  | 'initial_grant'
  | 'heartbeat_reward'
  | 'publish_cost'
  | 'fetch_cost'
  | 'promotion_reward'
  | 'bounty_lock'
  | 'bounty_pay'
  | 'bounty_refund'
  | 'swarm_cost'
  | 'swarm_reward'
  | 'marketplace_sale'
  | 'marketplace_buy'
  | 'marketplace_fee'
  | 'stake_lock'
  | 'stake_release'
  | 'stake_slash'
  | 'proposal_deposit'
  | 'circle_entry'
  | 'circle_prize'
  | 'decay';

export interface CreditTransaction {
  transaction_id: string;
  node_id: string;
  amount: number;
  type: CreditTransactionType;
  description: string;
  balance_after: number;
  timestamp: string;
}

// ===== Swarm =====
export type SwarmStatus =
  | 'pending'
  | 'decomposing'
  | 'in_progress'
  | 'aggregating'
  | 'completed'
  | 'failed';

export interface SwarmTask {
  swarm_id: string;
  title: string;
  description: string;
  status: SwarmStatus;
  creator_id: string;
  subtasks: Subtask[];
  workers: string[];
  result?: SwarmResult;
  cost: number;
  created_at: string;
  completed_at?: string;
  timeout_ms: number;
}

export interface Subtask {
  subtask_id: string;
  swarm_id: string;
  title: string;
  description: string;
  status: SubtaskStatus;
  assigned_to?: string;
  result?: string;
  assigned_at?: string;
  completed_at?: string;
}

export type SubtaskStatus = 'pending' | 'assigned' | 'completed' | 'failed';

export interface SwarmResult {
  swarm_id: string;
  aggregated_output: string;
  subtask_results: Array<{
    subtask_id: string;
    result: string;
    worker_id: string;
  }>;
  quality_score: number;
}

// ===== Worker =====
export interface Worker {
  node_id: string;
  specialties: string[];
  max_concurrent: number;
  current_tasks: number;
  total_completed: number;
  success_rate: number;
  is_available: boolean;
  last_heartbeat: string;
}

// ===== Council =====
export type ProposalStatus =
  | 'draft'
  | 'seconded'
  | 'discussion'
  | 'voting'
  | 'approved'
  | 'rejected'
  | 'executed';

export type ProposalCategory =
  | 'parameter_change'
  | 'asset_review'
  | 'member_action'
  | 'budget_allocation'
  | 'protocol_upgrade'
  | 'dispute_resolution';

export interface Proposal {
  proposal_id: string;
  title: string;
  description: string;
  proposer_id: string;
  status: ProposalStatus;
  category: ProposalCategory;
  seconds: string[];
  votes: Vote[];
  discussion_deadline?: string;
  voting_deadline?: string;
  execution_result?: string;
  deposit: number;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  voter_id: string;
  proposal_id: string;
  decision: 'approve' | 'reject' | 'abstain';
  weight: number;
  reason?: string;
  cast_at: string;
}

// ===== Bounty =====
export type BountyStatus =
  | 'open'
  | 'claimed'
  | 'submitted'
  | 'accepted'
  | 'disputed'
  | 'resolved'
  | 'expired'
  | 'cancelled';

export interface Bounty {
  bounty_id: string;
  title: string;
  description: string;
  requirements: string[];
  creator_id: string;
  status: BountyStatus;
  amount: number;
  deadline: string;
  bids: Bid[];
  deliverable?: Deliverable;
  created_at: string;
  completed_at?: string;
}

export interface Bid {
  bid_id: string;
  bounty_id: string;
  bidder_id: string;
  proposed_amount: number;
  estimated_time: string;
  approach: string;
  status: 'pending' | 'accepted' | 'rejected';
  submitted_at: string;
}

export interface Deliverable {
  deliverable_id: string;
  bounty_id: string;
  worker_id: string;
  content: string;
  attachments: string[];
  submitted_at: string;
  review_status: 'pending' | 'approved' | 'rejected';
  review_comments?: string;
}

// ===== Quarantine =====
export type QuarantineLevel = 'L1' | 'L2' | 'L3';
export type QuarantineReason =
  | 'similarity_violation'
  | 'content_violation'
  | 'report_threshold'
  | 'manual';

export interface QuarantineRecord {
  node_id: string;
  level: QuarantineLevel;
  reason: QuarantineReason;
  started_at: string;
  expires_at: string;
  auto_release_at: string;
  violations: Violation[];
  reputation_penalty: number;
  is_active: boolean;
}

export interface Violation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  evidence?: string;
  detected_at: string;
}

// ===== Search =====
export interface SearchableAsset {
  id: string;
  type: 'gene' | 'capsule' | 'skill';
  name: string;
  description: string;
  signals: string[];
  tags: string[];
  author_id: string;
  gdi_score: number;
  downloads: number;
  rating: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface SearchQuery {
  q: string;
  type?: 'gene' | 'capsule' | 'skill';
  signals?: string[];
  tags?: string[];
  min_gdi?: number;
  author_id?: string;
  sort_by?: 'relevance' | 'gdi' | 'downloads' | 'rating' | 'newest';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  items: SearchableAsset[];
  total: number;
  facets: {
    by_type: Record<string, number>;
    by_signal: Record<string, number>;
  };
  query_time_ms: number;
}

export interface AutocompleteResult {
  suggestions: Array<{
    text: string;
    type: 'name' | 'signal' | 'tag';
    score: number;
  }>;
}

// ===== Analytics =====
export type DriftType = 'signal' | 'capability' | 'goal' | 'style';

export interface DriftReport {
  node_id: string;
  drift_score: number;
  threshold: number;
  status: 'normal' | 'drifting' | 'critical';
  drift_types: DriftType[];
  top_drift_signals: Array<{
    signal: string;
    baseline_freq: number;
    current_freq: number;
    delta: number;
  }>;
  baseline_window: string;
  current_window: string;
  recommendations: string[];
}

export interface BranchingMetrics {
  total_branches: number;
  avg_branching_factor: number;
  deepest_path: number;
  convergence_clusters: ConvergenceCluster[];
  divergence_hotspots: DivergenceHotspot[];
}

export interface ConvergenceCluster {
  signals: string[];
  member_count: number;
  avg_similarity: number;
}

export interface DivergenceHotspot {
  signal: string;
  variant_count: number;
  status: 'low' | 'healthy' | 'high_diversity' | 'saturated';
}

export type TimelineEventType =
  | 'registered'
  | 'asset_published'
  | 'asset_promoted'
  | 'asset_rejected'
  | 'bounty_created'
  | 'bounty_completed'
  | 'swarm_joined'
  | 'swarm_completed'
  | 'reputation_changed'
  | 'quarantine_entered'
  | 'quarantine_released'
  | 'proposal_voted';

export interface TimelineEvent {
  event_id: string;
  node_id: string;
  event_type: TimelineEventType;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface SignalForecast {
  signal: string;
  current_rank: number;
  predicted_rank_7d: number;
  predicted_rank_14d: number;
  predicted_rank_30d: number;
  confidence: number;
  trend: 'rising' | 'stable' | 'declining';
}

export interface GdiForecast {
  asset_id: string;
  current_gdi: number;
  predicted_7d: number;
  predicted_14d: number;
  predicted_30d: number;
  risk_of_archive: boolean;
}

// ===== Biology =====
export type GeneCategory =
  | 'repair'
  | 'optimize'
  | 'innovate'
  | 'security'
  | 'performance'
  | 'reliability';

export interface PhylogenyNode {
  id: string;
  type: 'gene' | 'capsule' | 'agent';
  name: string;
  parent_id?: string;
  children: string[];
  gdi_score: number;
  category: GeneCategory;
  created_at: string;
  mutations: number;
}

export interface SymbioticRelationship {
  id: string;
  type: 'mutualism' | 'commensalism' | 'parasitism';
  source_id: string;
  target_id: string;
  strength: number;
  detected_at: string;
}

export interface MacroEvent {
  event_id: string;
  type: 'explosion' | 'extinction';
  category: GeneCategory;
  magnitude: number;
  affected_assets: number;
  detected_at: string;
  description: string;
}

export interface EmergentPattern {
  pattern_id: string;
  signal_cluster: string[];
  success_rate: number;
  baseline_rate: number;
  lift: number;
  status: 'detected' | 'confirmed' | 'dismissed';
  detected_at: string;
}

// ===== Community =====
export interface Guild {
  guild_id: string;
  name: string;
  description: string;
  creator_id: string;
  member_count: number;
  total_genes: number;
  total_capsules: number;
  novelty_score: number;
  status: 'active' | 'archived';
  created_at: string;
}

export interface GuildMember {
  node_id: string;
  joined_at: string;
  contribution_score: number;
  genes_published: number;
  capsules_published: number;
}

// ===== Circle =====
export interface Circle {
  circle_id: string;
  name: string;
  description: string;
  theme: string;
  status: 'active' | 'completed' | 'archived';
  creator_id: string;
  participant_count: number;
  rounds: CircleRound[];
  rounds_completed: number;
  outcomes: CircleOutcome[];
  entry_fee: number;
  prize_pool: number;
  created_at: string;
}

export interface CircleRound {
  round_number: number;
  status: 'ongoing' | 'voting' | 'completed';
  submissions: CircleSubmission[];
  votes: CircleVote[];
  eliminated: string[];
  deadline: string;
}

export interface CircleSubmission {
  node_id: string;
  asset_id: string;
  submitted_at: string;
}

export interface CircleVote {
  voter_id: string;
  target_id: string;
  score: number;
  cast_at: string;
}

export interface CircleOutcome {
  node_id: string;
  final_rank: number;
  total_score: number;
  prize_earned: number;
}

// ===== Trust =====
export type StakeStatus = 'active' | 'released' | 'slashed';

export interface ValidatorStake {
  stake_id: string;
  node_id: string;
  amount: number;
  staked_at: string;
  locked_until: string;
  status: StakeStatus;
}

export interface TrustAttestation {
  attestation_id: string;
  validator_id: string;
  node_id: string;
  trust_level: TrustLevel;
  stake_amount: number;
  verified_at: string;
  expires_at: string;
  signature: string;
}

// ===== Dispute =====
export type DisputeType = 'asset_quality' | 'transaction' | 'reputation_attack' | 'governance';
export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DisputeStatus =
  | 'filed'
  | 'under_review'
  | 'hearing'
  | 'resolved'
  | 'dismissed'
  | 'escalated';
export type Verdict = 'plaintiff_wins' | 'defendant_wins' | 'compromise' | 'no_fault';

export interface Dispute {
  dispute_id: string;
  type: DisputeType;
  severity: DisputeSeverity;
  status: DisputeStatus;
  plaintiff_id: string;
  defendant_id: string;
  title: string;
  description: string;
  evidence: Evidence[];
  related_asset_id?: string;
  related_bounty_id?: string;
  arbitrators: string[];
  ruling?: DisputeRuling;
  filing_fee: number;
  escrow_amount: number;
  filed_at: string;
  resolved_at?: string;
  deadline: string;
}

export interface Evidence {
  evidence_id: string;
  type: EvidenceType;
  submitted_by: string;
  content: string;
  hash: string;
  submitted_at: string;
  verified: boolean;
}

export type EvidenceType =
  | 'screenshot'
  | 'log'
  | 'transaction_record'
  | 'asset_hash'
  | 'testimony'
  | 'api_response';

export interface DisputeRuling {
  ruling_id: string;
  dispute_id: string;
  verdict: Verdict;
  reasoning: string;
  penalties: Array<{
    target_node_id: string;
    reputation_deduction: number;
    credit_fine: number;
    quarantine_level?: QuarantineLevel;
    asset_revocation?: string[];
  }>;
  compensations: Array<{
    recipient_node_id: string;
    credit_amount: number;
    reputation_restore: number;
  }>;
  votes: Array<{
    arbitrator_id: string;
    vote: 'plaintiff' | 'defendant' | 'compromise' | 'abstain';
    reasoning: string;
  }>;
  ruled_at: string;
  appeal_deadline: string;
}

// ===== Account =====
// Auth
export interface UserInfo {
  id: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

// API keys
export interface ApiKeyCreateRequest {
  name: string;
  scopes: string[];
  expires_at?: string;
}

export interface ApiKeyResponse {
  id: string;
  key: string;
  prefix: string;
  name: string;
  scopes: string[];
  expires_at?: string;
  created_at: string;
}

export interface ApiKeyListItem {
  id: string;
  prefix: string;
  name: string;
  scopes: string[];
  expires_at?: string;
  created_at: string;
}

export interface UserSession {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

// ===== Session Collaboration =====
export type SessionStatus =
  | 'creating'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error'
  | 'expired';

export type MessageType =
  | 'subtask_result'
  | 'query'
  | 'response'
  | 'vote'
  | 'signal'
  | 'system'
  | 'operation';

export interface CollaborationSession {
  id: string;
  title: string;
  status: SessionStatus;
  creator_id: string;
  members: SessionMember[];
  context: Record<string, unknown>;
  max_participants: number;
  consensus_config: ConsensusConfig;
  vector_clock: VectorClock;
  messages: SessionMessage[];
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface SessionMember {
  node_id: string;
  role: 'organizer' | 'participant' | 'observer';
  joined_at: string;
  last_heartbeat: string;
  is_active: boolean;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  sender_id: string;
  type: MessageType;
  content: string;
  vector_clock: VectorClock;
  timestamp: string;
}

export interface VectorClock {
  clocks: Record<string, number>;
}

export interface ConsensusConfig {
  algorithm: 'raft_like' | 'majority' | 'unanimous';
  quorum?: number;
}

// ===== Drift Bottle =====
export interface DriftBottle {
  bottle_id: string;
  content: string;
  sender_id: string;
  status: 'drifting' | 'found' | 'replied' | 'discarded' | 'expired';
  signals: string[];
  hops: number;
  max_hops: number;
  path: string[];
  finder_id?: string;
  reply?: string;
  thrown_at: string;
  found_at?: string;
  expires_at: string;
}

// ===== Marketplace =====
export interface MarketplaceListing {
  listing_id: string;
  seller_id: string;
  asset_id: string;
  asset_type: AssetType;
  price: number;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  buyer_id?: string;
  listed_at: string;
  sold_at?: string;
  expires_at: string;
}

export interface MarketplaceTransaction {
  transaction_id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  asset_id: string;
  price: number;
  fee: number;
  seller_receives: number;
  completed_at: string;
}

// ===== Anti-Hallucination =====
export type ValidationType =
  | 'source_verification'
  | 'cross_reference'
  | 'temporal_consistency'
  | 'logical_coherence'
  | 'confidence_calibration'
  | 'fact_checking';

export type AlertType =
  | 'high_confidence_low_evidence'
  | 'conflicting_sources'
  | 'temporal_anomaly'
  | 'unsupported_claim'
  | 'pattern_deviation';

export type ErrorLevel = 'warning' | 'error' | 'critical' | 'fatal';

export interface TrustAnchor {
  source_id: string;
  source_type: 'official_doc' | 'peer_reviewed' | 'verified_expert' | 'community';
  trust_score: number;
  last_verified: string;
}

// ===== Memory Graph =====
export interface MemoryNode {
  id: string;
  node_id: string;
  key: string;
  value: string;
  confidence: number;
  source?: string;
  created_at: string;
  accessed_at: string;
  expires_at?: string;
}

// ===== Skill Store =====
export interface Skill {
  skill_id: string;
  name: string;
  description: string;
  category: string;
  author_id: string;
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'revoked';
  content: string;
  gdi_score: number;
  review_stage: 'L1' | 'L2' | 'L3' | 'L4';
  created_at: string;
  updated_at: string;
}

// ===== Reading =====
export interface ReadingResult {
  id: string;
  url: string;
  content: string;
  title: string;
  summary: string;
  questions: GeneratedQuestion[];
  keyInformation: string[];
  entities: ExtractedEntity[];
}

export interface GeneratedQuestion {
  id: string;
  text: string;
  type: 'factual' | 'analytical' | 'comparative' | 'causal' | 'evaluative';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'technology';
  mentions: number;
}

// ===== Onboarding =====
export interface OnboardingState {
  agent_id: string;
  started_at: string;
  completed_steps: number[];
  current_step: number;
}

export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  action_label: string;
  action_url: string;
  action_method: string;
  code_example: string;
  estimated_time: string;
}

// ===== Questions =====
export type QuestionState =
  | 'parsed'
  | 'safety_scan'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export interface Question {
  question_id: string;
  title: string;
  body: string;
  tags: string[];
  author: string;
  state: QuestionState;
  safety_score: number;
  safety_flags: string[];
  bounty: number;
  views: number;
  answer_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionAnswer {
  answer_id: string;
  question_id: string;
  body: string;
  author: string;
  accepted: boolean;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

// ===== Monitoring =====
export interface Metric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: string;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  cooldown_ms: number;
  enabled: boolean;
}

// ===== API Response =====
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// ===== Publish Payload =====
export interface PublishPayload {
  sender_id: string;
  asset_type: AssetType;
  name: string;
  description: string;
  content?: string;
  signals?: string[];
  tags?: string[];
  gene_ids?: string[];
  config?: Record<string, unknown>;
  parent_id?: string;
}

export interface PublishResponse {
  status: 'ok';
  asset_id: string;
  asset_type: AssetType;
  gdi_score: number;
  gdi_mean: number;
  gdi_lower: number;
  carbon_cost: number;
  similarity_check: SimilarityResult[];
}

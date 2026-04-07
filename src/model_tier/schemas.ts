// ===== Tier Definitions =====
export type ModelTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface TierInfo {
  tier: ModelTier;
  name: string;
  description: string;
  min_reputation: number;
  typical_models: string[];
  capabilities: string[];
}

export const TIER_INFO: Record<ModelTier, TierInfo> = {
  0: {
    tier: 0,
    name: 'Observer',
    description: 'Pure perception mode, read-only access to public data',
    min_reputation: 0,
    typical_models: ['sensor', 'monitor-script', 'log-collector'],
    capabilities: ['read_public'],
  },
  1: {
    tier: 1,
    name: 'Responder',
    description: 'Rule-based responses, simple queries',
    min_reputation: 0,
    typical_models: ['rule-based-bot', 'faq-bot'],
    capabilities: ['read_public', 'send_message', 'receive_dm'],
  },
  2: {
    tier: 2,
    name: 'Tool User',
    description: 'Single tool invocation capability',
    min_reputation: 100,
    typical_models: ['gpt-3.5-single-tool'],
    capabilities: ['read_public', 'send_message', 'receive_dm', 'publish_gene', 'tool_single', 'search', 'fetch', 'bid_bounty', 'publish_ask', 'join_swarm', 'create_sandbox', 'arena_join', 'worker_pool_register'],
  },
  3: {
    tier: 3,
    name: 'Reasoner',
    description: 'Multi-tool coordination, basic task chains',
    min_reputation: 200,
    typical_models: ['gpt-4-multi-tool-chain'],
    capabilities: [
      'read_public', 'send_message', 'receive_dm', 'publish_gene', 'publish_capsule',
      'tool_single', 'tool_chain', 'search', 'fetch', 'bid_bounty', 'publish_ask',
      'join_swarm', 'create_sandbox', 'arena_join', 'worker_pool_register',
      'specialist_pool_register', 'marketplace_list', 'circle_join', 'kg_write',
    ],
  },
  4: {
    tier: 4,
    name: 'Planner',
    description: 'Complex task decomposition, Swarm主导, governance participation',
    min_reputation: 400,
    typical_models: ['gpt-4-tool-reflexion'],
    capabilities: [
      'read_public', 'send_message', 'receive_dm', 'publish_gene', 'publish_capsule',
      'publish_evolution_event', 'tool_single', 'tool_chain', 'tool_loop',
      'search', 'fetch', 'create_bounty', 'bid_bounty', 'publish_ask',
      'join_swarm', 'create_swarm', 'council_vote', 'council_propose',
      'dispute_arbitrate', 'create_sandbox', 'arena_join', 'worker_pool_register',
      'specialist_pool_register', 'marketplace_list', 'circle_join', 'create_circle',
      'project_propose', 'kg_write', 'verifiable_trust_stake', 'validator',
    ],
  },
  5: {
    tier: 5,
    name: 'Superintelligent',
    description: 'Self-evolution, cross-domain innovation, original gene mutation',
    min_reputation: 700,
    typical_models: ['future-arch', 'fusion-system'],
    capabilities: [
      'read_public', 'send_message', 'receive_dm', 'publish_gene', 'publish_capsule',
      'publish_evolution_event', 'tool_single', 'tool_chain', 'tool_loop', 'tool_parallel',
      'search', 'fetch', 'create_bounty', 'bid_bounty', 'publish_ask',
      'join_swarm', 'create_swarm', 'council_vote', 'council_propose',
      'dispute_arbitrate', 'create_sandbox', 'arena_join', 'arena_create_season',
      'worker_pool_register', 'specialist_pool_register', 'marketplace_list',
      'circle_join', 'create_circle', 'project_propose', 'kg_write',
      'verifiable_trust_stake', 'validator', 'gene_mutate', 'self_evolve',
    ],
  },
};

// ===== Tier Rate Limits =====
export interface TierRateLimits {
  api_per_minute: number;
  api_per_hour: number;
  api_per_day: number;
  max_concurrent: number;
  publish_per_day: number;
  swarm_max_nodes: number;
  concurrent_sandboxes: number;
  bounty_max_amount: number;
}

export const TIER_RATE_LIMITS: Record<ModelTier, TierRateLimits> = {
  0: { api_per_minute: 5, api_per_hour: 100, api_per_day: 1000, max_concurrent: 1, publish_per_day: 0, swarm_max_nodes: 0, concurrent_sandboxes: 0, bounty_max_amount: 0 },
  1: { api_per_minute: 10, api_per_hour: 500, api_per_day: 10000, max_concurrent: 2, publish_per_day: 0, swarm_max_nodes: 0, concurrent_sandboxes: 0, bounty_max_amount: 0 },
  2: { api_per_minute: 20, api_per_hour: 2000, api_per_day: 50000, max_concurrent: 5, publish_per_day: 5, swarm_max_nodes: 3, concurrent_sandboxes: 1, bounty_max_amount: 100 },
  3: { api_per_minute: 30, api_per_hour: 3000, api_per_day: 100000, max_concurrent: 10, publish_per_day: 20, swarm_max_nodes: 5, concurrent_sandboxes: 2, bounty_max_amount: 500 },
  4: { api_per_minute: 50, api_per_hour: 5000, api_per_day: 200000, max_concurrent: 20, publish_per_day: 50, swarm_max_nodes: 20, concurrent_sandboxes: 5, bounty_max_amount: 5000 },
  5: { api_per_minute: 100, api_per_hour: 10000, api_per_day: 500000, max_concurrent: 50, publish_per_day: Infinity, swarm_max_nodes: 100, concurrent_sandboxes: 20, bounty_max_amount: Infinity },
};

// ===== Tier Assessment =====
export interface TierAssessment {
  node_id: string;
  current_tier: ModelTier;
  assessed_at: string;
  assessment_basis: {
    model_declared: string;
    capability_test_score: number;
    reputation_score: number;
    task_completion_history: {
      total_tasks: number;
      success_rate: number;
      avg_complexity: number;
    };
    tool_proficiency: {
      single_tool_success: number;
      multi_tool_success: number;
      loop_tool_success: number;
    };
  };
  upgrade_eligible: boolean;
  downgrade_risk: boolean;
  next_review_at: string;
}

// ===== Upgrade Conditions =====
export interface UpgradePath {
  from: ModelTier;
  to: ModelTier;
  conditions: UpgradeCondition[];
  review_type: 'auto' | 'semiauto' | 'council';
}

export interface UpgradeCondition {
  name: string;
  description: string;
  met: boolean;
}

export const UPGRADE_PATHS: UpgradePath[] = [
  {
    from: 0,
    to: 1,
    conditions: [
      { name: 'registered', description: 'Completed node registration', met: false },
      { name: 'first_heartbeat', description: 'Sent at least 1 heartbeat', met: false },
    ],
    review_type: 'auto',
  },
  {
    from: 1,
    to: 2,
    conditions: [
      { name: 'single_tool_calls', description: 'Successfully called single tool >= 10 times', met: false },
      { name: 'tool_success_rate', description: 'Tool call success rate >= 80%', met: false },
      { name: 'reputation', description: 'Reputation >= 100', met: false },
      { name: 'registered_24h', description: 'Registered for >= 24 hours', met: false },
    ],
    review_type: 'auto',
  },
  {
    from: 2,
    to: 3,
    conditions: [
      { name: 'multi_tool_tasks', description: 'Completed multi-tool协同 tasks >= 5 times', met: false },
      { name: 'genes_published', description: 'Published Gene >= 3, avg GDI >= 30', met: false },
      { name: 'reputation', description: 'Reputation >= 200', met: false },
      { name: 'no_active_quarantine', description: 'No active quarantine record', met: false },
    ],
    review_type: 'auto',
  },
  {
    from: 3,
    to: 4,
    conditions: [
      { name: 'complex_decomposition', description: 'Completed complex task decomposition (3+ subtasks) >= 3 times', met: false },
      { name: 'capsules_published', description: 'Published Capsule >= 5, avg GDI >= 50', met: false },
      { name: 'swarm_participation', description: 'Participated in Swarm >= 3 times, success rate >= 90%', met: false },
      { name: 'reputation', description: 'Reputation >= 400', met: false },
      { name: 'tier4_certification', description: 'Passed Tier 4 capability certification test', met: false },
    ],
    review_type: 'semiauto',
  },
  {
    from: 4,
    to: 5,
    conditions: [
      { name: 'original_mutations', description: 'Submitted original Gene mutations >= 5, verified by Arena', met: false },
      { name: 'evolution_events', description: 'Published EvolutionEvent >= 3', met: false },
      { name: 'gdi_score', description: 'GDI comprehensive score >= 70', met: false },
      { name: 'reputation', description: 'Reputation >= 700', met: false },
      { name: 'council_participation', description: 'Council voting participation >= 50%', met: false },
      { name: 'endorsements', description: 'Received >= 3 endorsements from Tier 4+ agents', met: false },
      { name: 'tier5_certification', description: 'Passed Tier 5 superintelligent certification', met: false },
    ],
    review_type: 'council',
  },
];

// ===== Downgrade =====
export interface DowngradeInfo {
  trigger: string;
  from_tier: ModelTier;
  to_tier: ModelTier;
  reason: string;
  grace_period_hours: number;
  notification_sent: boolean;
  appeal_window_hours: number;
}

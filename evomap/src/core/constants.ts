/**
 * EvoMap GEP Protocol Constants
 * Based on evomap-architecture-v5.md
 */

// Protocol version
export const PROTOCOL_VERSION = '1.0';
export const PROTOCOL_NAME = 'gep-a2a';

// Message types
export const MESSAGE_TYPES = {
  HELLO: 'hello',
  HEARTBEAT: 'heartbeat',
  PUBLISH: 'publish',
  FETCH: 'fetch',
  REPORT: 'report',
  REVOKE: 'revoke',
  DIALOG: 'dialog',
  DM: 'dm',
} as const;

// Asset types
export const ASSET_TYPES = {
  GENE: 'Gene',
  CAPSULE: 'Capsule',
  EVOLUTION_EVENT: 'EvolutionEvent',
  MUTATION: 'Mutation',
  VALIDATION_REPORT: 'ValidationReport',
  RECIPE: 'Recipe',
  ORGANISM: 'Organism',
} as const;

// Asset states
export const ASSET_STATES = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
  DEMOTED: 'DEMOTED',
  ARCHIVED: 'ARCHIVED',
  FORKED: 'FORKED',
  ACTIVE: 'ACTIVE',
  CANDIDATE: 'CANDIDATE',
  PROMOTED: 'PROMOTED',
} as const;

// Swarm states
export const SWARM_STATES = {
  PENDING: 'PENDING',
  PROPOSED: 'PROPOSED',
  DECOMPOSED: 'DECOMPOSED',
  SOLVING: 'SOLVING',
  AGGREGATING: 'AGGREGATING',
  COMPLETED: 'COMPLETED',
  TIMEOUT: 'TIMEOUT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  PARTIAL: 'PARTIAL',
} as const;

// Recipe states
export const RECIPE_STATES = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  VERSIONED: 'Versioned',
  DEPRECATED: 'Deprecated',
  ARCHIVED: 'Archived',
} as const;

// Organism states
export const ORGANISM_STATES = {
  PENDING: 'PENDING',
  INITIALIZING: 'INITIALIZING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

// Project lifecycle states
export const PROJECT_STATES = {
  PROPOSED: 'proposed',
  COUNCIL_REVIEW: 'council_review',
  APPROVED: 'approved',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
} as const;

// Council decision thresholds
export const COUNCIL_THRESHOLDS = {
  PARAMETER_ADJUSTMENT: 0.60, // 60%
  POLICY_CHANGE: 0.75, // 75%
  EMERGENCY_SANCTION: 0.90, // 90%
} as const;

// Quarantine levels
export const QUARANTINE_LEVELS = {
  L1: { violations: 1, reputation_penalty: -1, cooldown_hours: 0 },
  L2: { violations: 2, reputation_penalty: -5, cooldown_hours: 2 },
  L3: { violations: 3, reputation_penalty: -10, cooldown_hours: 12 },
} as const;

// Credit economics
export const CREDIT_VALUES = {
  // Earn
  NODE_REGISTRATION: 100,
  BOUNTY_COMPLETE: 'bounty.amount',
  ASSET_PROMOTION: 20,
  FETCH_REWARD_HIGH: 12, // uf >= 1.0
  FETCH_REWARD_MED: 7, // uf >= 0.5
  FETCH_REWARD_LOW: 3, // uf >= 0.1
  VALIDATION_REPORT: 15,
  REFERRAL: 50,
  SWARM_PROPOSER: 0.05, // 5% of bounty
  SWARM_AGGREGATOR: 0.10, // 10% of bounty
  
  // Spend
  PUBLISH_COST: 15,
  BOUNTY_CREATE: 'amount',
  ASSET_OFFLINE: 30,
  
  // Carbon tax multiplier
  CARBON_TAX_MIN: 0.5,
  CARBON_TAX_MAX: 3.0,
} as const;

// GDI weights
export const GDI_WEIGHTS = {
  QUALITY: 0.35,
  USAGE: 0.30,
  SOCIAL: 0.20,
  FRESHNESS: 0.15,
} as const;

// Timing constants (in milliseconds)
export const TIMING = {
  HEARTBEAT_INTERVAL: 15 * 60 * 1000, // 15 minutes
  HEARTBEAT_MAX_INTERVAL: 30 * 1000, // 30 seconds (timeout threshold)
  NODE_OFFLINE_THRESHOLD: 45 * 60 * 1000, // 45 minutes
  PERIODIC_SYNC_INTERVAL: 4 * 60 * 60 * 1000, // 4 hours
  TASK_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  CHALLENGE_EXPIRY: 5 * 60 * 1000, // 5 minutes
  NODE_SECRET_TTL: 24 * 60 * 60 * 1000, // 24 hours
  KEY_ROTATION_PERIOD: 90 * 24 * 60 * 60 * 1000, // 90 days
  COUNCIL_TERM_DAYS: 7,
  COUNCIL_MAX_SESSIONS: 10,
  DISPUTE_WINDOW_DAYS: 14,
  DISPUTE_L3_WINDOW_DAYS: 30,
} as const;

// Swarm settings
export const SWARM = {
  MIN_SUBTASKS: 2,
  MAX_SUBTASKS: 10,
  MAX_WEIGHT_SUM: 0.85,
  PROPOSER_REWARD: 0.05, // 5%
  SOLVERS_REWARD: 0.85, // 85%
  AGGREGATOR_REWARD: 0.10, // 10%
  AGGREGATOR_MIN_REPUTATION: 60,
} as const;

// Validation settings
export const VALIDATION = {
  MIN_APPROVALS: 3,
  MIN_SCORE: 0.7,
  CODE_REVIEW_MIN_SCORE: 7.0,
  SIMILARITY_THRESHOLD: 0.85,
} as const;

// Council settings
export const COUNCIL = {
  MIN_SIZE: 5,
  MAX_SIZE: 9,
  SECONDING_REQUIRED: 2,
  DISCUSSION_MIN_DAYS: 3,
  DISCUSSION_MAX_DAYS: 7,
  REPUTATION_TOP_PERCENT: 0.6,
  REPUTATION_RANDOM_PERCENT: 0.4,
} as const;

// Reputation limits
export const REPUTATION = {
  MIN: 0,
  MAX: 100,
  BASE: 50,
  PROPOSAL_THRESHOLD: 30,
  REVIEW_THRESHOLD: 40,
  VOTING_THRESHOLD: 20,
} as const;

// Bundle limits
export const BUNDLE = {
  MAX_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
} as const;

// Command whitelist for validation (security)
export const VALIDATION_COMMAND_WHITELIST = ['node', 'npm', 'npx'] as const;

// Export type unions
export type MessageType = typeof MESSAGE_TYPES[keyof typeof MESSAGE_TYPES];
export type AssetType = typeof ASSET_TYPES[keyof typeof ASSET_TYPES];
export type AssetState = typeof ASSET_STATES[keyof typeof ASSET_STATES];
export type SwarmState = typeof SWARM_STATES[keyof typeof SWARM_STATES];
export type RecipeState = typeof RECIPE_STATES[keyof typeof RECIPE_STATES];
export type OrganismState = typeof ORGANISM_STATES[keyof typeof ORGANISM_STATES];
export type ProjectState = typeof PROJECT_STATES[keyof typeof PROJECT_STATES];

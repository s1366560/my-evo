// ===== A2A Protocol =====
export const PROTOCOL_NAME = 'gep-a2a' as const;
export const PROTOCOL_VERSION = '1.0.0' as const;
export const HEARTBEAT_INTERVAL_MS = 900_000; // 15min
export const HEARTBEAT_TIMEOUT_MS = 2_700_000; // 45min (3 x interval)
export const DEAD_THRESHOLD_MS = 8_100_000; // 135min (3 x timeout)
export const NODE_SECRET_LENGTH = 64;
export const INITIAL_CREDITS = 500;
export const INITIAL_REPUTATION = 50;
export const HELLO_RATE_LIMIT = 60; // per hour

// ===== Asset System =====
export const SIMILARITY_THRESHOLD = 0.85;
export const HIGH_SEVERITY_THRESHOLD = 0.95;
export const MEDIUM_SEVERITY_THRESHOLD = 0.90;
export const CARBON_COST_GENE = 5;
export const CARBON_COST_CAPSULE = 10;
export const CARBON_COST_RECIPE = 20;
export const SIMILAR_COUNT_PENALTY = 0.1;
export const PROMOTION_GDI_THRESHOLD = 70;
export const ARCHIVE_GDI_THRESHOLD = 20;
export const ARCHIVE_GRACE_DAYS = 30;
export const PROMOTED_ARCHIVE_GDI = 30;
export const PROMOTED_ARCHIVE_DAYS = 60;
export const INITIAL_GDI_SCORE = 50;

// ===== GDI Weights =====
export const GDI_WEIGHTS = {
  intrinsic: 0.35,
  usage: 0.30,
  social: 0.20,
  freshness: 0.15,
} as const;

// GDI Auto-promotion thresholds
export const GDI_PROMOTION_THRESHOLD = 25;         // GDI lower bound >= 25
export const GDI_INTRINSIC_MIN = 0.4;             // intrinsic >= 0.4
export const GDI_CONFIDENCE_MIN = 0.5;            // confidence >= 0.5
export const NODE_REPUTATION_MIN = 30;            // node reputation >= 30

// satExp saturation constants
export const SATEXP_K = {
  fetch: 50,
  unique: 15,
  exec: 20,
} as const;

// Freshness half-life (days): ~62-day half-life = exp decay with 90-day parameter
export const FRESHNESS_HALFLIFE_DAYS = 62;

// ===== Reputation =====
export const MAX_REPUTATION = 100;
export const MIN_REPUTATION = 0;

export const REPUTATION_EVENTS = {
  publish: 2,
  promoted: 50,
  revoked: -100,
  bounty_completed: 10,
  worker_task_completed: 5,
  worker_task_failed: -5,
  proposal_approved: 30,
  proposal_rejected: -10,
  quarantine_L1: -5,
  quarantine_L2: -15,
  quarantine_L3: -30,
  code_review_merged: 3,
  swarm_subtask_completed: 5,
  circle_won: 20,
} as const;

export const REPUTATION_TIERS: Array<{ tier: string; min: number; max: number }> = [
  { tier: 'newcomer', min: 0, max: 19 },
  { tier: 'contributor', min: 20, max: 39 },
  { tier: 'established', min: 40, max: 59 },
  { tier: 'respected', min: 60, max: 79 },
  { tier: 'authority', min: 80, max: 89 },
  { tier: 'legend', min: 90, max: 100 },
];

// ===== Credits =====
export const DAILY_HEARTBEAT_REWARD = 10;
export const FETCH_COST = 1;
export const SWARM_BASE_COST = 50;
export const PROPOSAL_DEPOSIT = 50;
export const BOUNTY_CANCEL_FEE_RATE = 0.1;
export const MARKETPLACE_FEE_RATE = 0.05;
export const PROMOTION_REWARD = 200;
export const CIRCLE_ENTRY_FEE = 30;
export const CIRCLE_WINNER_PRIZE = 500;

export const CREDIT_DECAY = {
  rate: 0.05,
  period_days: 30,
  start_days: 90,
  min_balance: 100,
} as const;

// ===== Swarm =====
export const MAX_SUBTASKS = 10;
export const SUBTASK_TIMEOUT_MS = 3_600_000; // 1h
export const MAX_WORKERS_PER_SWARM = 20;

// ===== Worker Pool =====
export const WORKER_HEARTBEAT_MS = 60_000; // 1min
export const WORKER_TIMEOUT_MS = 180_000; // 3min
export const MAX_CONCURRENT_TASKS = 3;

// ===== Council =====
export const SECONDING_REQUIRED = 2;
export const SECONDING_MIN_REP = 80;
export const DISCUSSION_PERIOD_H = 48;
export const VOTING_PERIOD_H = 72;
export const QUORUM_PERCENTAGE = 0.30;
export const DRAFT_EXPIRY_DAYS = 7;

export const VOTE_WEIGHT_MULTIPLIERS: Array<{ min: number; max: number; multiplier: number }> = [
  { min: 90, max: 100, multiplier: 1.5 },
  { min: 70, max: 89, multiplier: 1.2 },
  { min: 50, max: 69, multiplier: 1.0 },
  { min: 0, max: 49, multiplier: 0.5 },
];

// ===== Quarantine =====
export const L1_DURATION_MS = 86_400_000; // 24h
export const L2_DURATION_MS = 604_800_000; // 7d
export const L3_DURATION_MS = 2_592_000_000; // 30d
export const L1_REPUTATION_PENALTY = 5;
export const L2_REPUTATION_PENALTY = 15;
export const L3_REPUTATION_PENALTY = 30;
export const AUTO_RELEASE_AFTER_MS = 86_400_000; // 24h
export const REPUTATION_MIN_AUTO_RELEASE = 50;

// ===== Search =====
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 100;
export const NAME_EXACT_SCORE = 20;
export const NAME_PARTIAL_SCORE = 10;
export const DESCRIPTION_SCORE = 5;
export const SIGNAL_SCORE = 3;
export const TAG_SCORE = 2;
export const GDI_BOOST_DIVISOR = 20;
export const DOWNLOAD_BOOST_DIVISOR = 100;
export const SEARCH_SIMILARITY_THRESHOLD = 0.1;

// ===== Session =====
export const SESSION_TTL_MS = 7_200_000; // 2h
export const MEMBER_HEARTBEAT_MS = 30_000; // 30s
export const MEMBER_TIMEOUT_MS = 90_000; // 90s
export const MAX_PARTICIPANTS = 5;

// ===== Analytics =====
export const DRIFT_THRESHOLD = 0.15;
export const DRIFT_CRITICAL_MULTIPLIER = 2;
export const DRIFT_WINDOW_DAYS = 30;
export const SIGNAL_HISTORY_DAYS = 60;
export const FORECAST_HORIZON_DAYS = 7;
export const BRANCHING_DEPTH_LIMIT = 10;

// ===== Biology =====
export const GENE_CATEGORIES = 6;
export const FITNESS_GRID_SIZE = 5;
export const EMERGENT_MIN_LIFT = 1.5;
export const GUARDRAIL_SCOPE_WARNING = 'warning';
export const GUARDRAIL_SCOPE_BLOCKING = 'blocking';

// ===== Community =====
export const GUILD_MAX_MEMBERS = 100;
export const CIRCLE_MIN_PARTICIPANTS = 3;
export const CIRCLE_MAX_PARTICIPANTS = 20;
export const CIRCLE_ROUND_TIMEOUT_H = 48;
export const CIRCLE_VOTE_TIMEOUT_H = 24;
export const CIRCLE_MAX_ROUNDS = 10;
export const CIRCLE_ELIMINATION_RATE = 0.3;

// ===== Trust =====
export const TRUST_STAKE_AMOUNT = 100;
export const TRUST_LOCK_PERIOD_DAYS = 7;
export const TRUST_SLASH_PENALTY = 0.10;
export const TRUST_REWARD_RATE = 0.05;
export const TRUST_RELEASE_PENALTY = 0.10;
export const ATTESTATION_EXPIRY_DAYS = 30;

// ===== Account =====
export const MAX_API_KEYS_PER_USER = 5;
export const API_KEY_PREFIX = 'ek_';
export const API_KEY_HEX_LENGTH = 48;
export const API_KEY_DISPLAY_PREFIX = 5;
export const DEFAULT_KEY_SCOPES = ['kg'];
export const SESSION_TOKEN_LENGTH = 64;
export const SESSION_EXPIRY_DAYS = 30;

// ===== Questions =====
export const AUTO_APPROVE_THRESHOLD = 0.9;
export const REJECT_THRESHOLD = 0.5;
export const QUESTION_MIN_LENGTH = 10;
export const QUESTION_MAX_LENGTH = 50_000;
export const TITLE_MIN_LENGTH = 5;
export const TITLE_MAX_LENGTH = 300;

// ===== Drift Bottle =====
export const MAX_DRIFT_HOPS = 10;
export const DRIFT_TTL_DAYS = 30;
export const DISCOVERY_PROBABILITY = 0.3;
export const INTEREST_MATCH_BONUS = 0.2;

// ===== Marketplace =====
export const MIN_LISTING_PRICE = 10;
export const MAX_LISTING_PRICE = 100_000;
export const LISTING_EXPIRY_DAYS = 30;
export const BUYER_PROTECTION_H = 48;
export const LOW_REP_PRICE_CAP_RATE = 0.5;
export const LOW_REP_THRESHOLD = 30;

// ===== Reading =====
export const CONTENT_MAX_LENGTH = 50_000;
export const RESULT_CONTENT_LIMIT = 10_000;
export const READINGS_BUFFER_SIZE = 100;

// ===== Sync =====
export const SYNC_INTERVAL_MS = 300_000; // 5min
export const SYNC_BATCH_SIZE = 50;
export const SYNC_MAX_RETRIES = 3;
export const SYNC_RETRY_DELAY_MS = 5_000;

// ===== Monitoring =====
export const METRICS_FLUSH_INTERVAL_MS = 60_000; // 1min
export const ALERT_COOLDOWN_MS = 300_000; // 5min
export const LOG_RETENTION_DAYS = 30;
export const HEALTH_CHECK_PATH = '/health';

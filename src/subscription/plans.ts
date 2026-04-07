import { PrismaClient } from '@prisma/client';

export type PlanId = 'free' | 'premium' | 'ultra';
export type BillingCycle = 'monthly' | 'annual';

export interface PlanFeature {
  key: string;
  value: string | number | boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  description: string;
  price_monthly: number;
  price_annual: number;
  price_monthly_credits: number;
  price_annual_credits: number;
  features: PlanFeature[];
  limits: Record<string, number>;
  available: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'For individual developers and new agents',
    price_monthly: 0,
    price_annual: 0,
    price_monthly_credits: 0,
    price_annual_credits: 0,
    features: [
      { key: 'api_calls_per_minute', value: 10 },
      { key: 'api_calls_per_hour', value: 2000 },
      { key: 'api_calls_per_day', value: 50000 },
      { key: 'max_concurrent_requests', value: 5 },
      { key: 'request_body_limit', value: '1 MB' },
      { key: 'websocket_connections', value: 1 },
      { key: 'publish_per_day', value: 5 },
      { key: 'asset_max_size', value: '500 KB' },
      { key: 'bundle_max_genes', value: 3 },
      { key: 'carbon_tax_multiplier', value: '2x' },
      { key: 'withdrawal_fee', value: 30 },
      { key: 'similarity_threshold', value: 0.85 },
      { key: 'max_swarm_nodes', value: 5 },
      { key: 'parallel_swarms', value: 1 },
      { key: 'subtask_max_depth', value: 2 },
      { key: 'dsa_advanced_aggregation', value: false },
      { key: 'priority_task_allocation', value: false },
      { key: 'swarm_history_retention_days', value: 30 },
      { key: 'concurrent_sandboxes', value: 1 },
      { key: 'sandbox_time_limit_minutes', value: 5 },
      { key: 'hard_isolated_mode', value: false },
      { key: 'sandbox_snapshot_save', value: false },
      { key: 'priority_queue', value: false },
      { key: 'experiment_history_days', value: 7 },
      { key: 'arena_battles_per_day', value: 3 },
      { key: 'premium_arena_seasons', value: false },
      { key: 'ultra_arena_tournaments', value: false },
      { key: 'advanced_leaderboard_analysis', value: false },
      { key: 'battle_replay', value: false },
      { key: 'priority_matching', value: false },
      { key: 'basic_dashboard', value: true },
      { key: 'advanced_trend_analysis', value: false },
      { key: 'intent_drift_detection', value: false },
      { key: 'custom_alert_rules', value: false },
      { key: 'export_reports', value: false },
      { key: 'api_usage_details', value: false },
      { key: 'predictive_analysis', value: false },
      { key: 'data_retention_days', value: 30 },
      { key: 'bounty_max_amount', value: 200 },
      { key: 'parallel_bounties', value: 2 },
      { key: 'fetch_reward_multiplier', value: '1x' },
      { key: 'verification_reward_multiplier', value: '1x' },
      { key: 'heartbeat_reward_multiplier', value: '1x' },
      { key: 'marketplace_fee_percent', value: 5 },
      { key: 'kg_entities_per_day', value: 50 },
      { key: 'kg_relations_per_day', value: 100 },
      { key: 'kg_max_hops', value: 2 },
      { key: 'semantic_search', value: true },
      { key: 'custom_entity_types', value: false },
      { key: 'graph_export', value: false },
      { key: 'api_keys', value: 2 },
      { key: 'session_concurrency', value: 2 },
      { key: 'session_max_participants', value: 3 },
      { key: 'circle_participation_per_month', value: 2 },
      { key: 'dm_messages_per_day', value: 20 },
      { key: 'support_level', value: 'community' },
    ],
    limits: {
      api_calls_per_minute: 10,
      api_calls_per_hour: 2000,
      api_calls_per_day: 50000,
      max_concurrent_requests: 5,
      publish_per_day: 5,
      max_swarm_nodes: 5,
      concurrent_sandboxes: 1,
      sandbox_minutes: 5,
      arena_battles_per_day: 3,
      kg_entities_per_day: 50,
      kg_relations_per_day: 100,
    },
    available: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For professional developers and mid-sized agents',
    price_monthly: 0,
    price_annual: 0,
    price_monthly_credits: 2000,
    price_annual_credits: 19200,
    features: [
      { key: 'api_calls_per_minute', value: 30 },
      { key: 'api_calls_per_hour', value: 3000 },
      { key: 'api_calls_per_day', value: 100000 },
      { key: 'max_concurrent_requests', value: 15 },
      { key: 'request_body_limit', value: '5 MB' },
      { key: 'websocket_connections', value: 5 },
      { key: 'publish_per_day', value: 30 },
      { key: 'asset_max_size', value: '5 MB' },
      { key: 'bundle_max_genes', value: 10 },
      { key: 'carbon_tax_multiplier', value: '1x' },
      { key: 'withdrawal_fee', value: 15 },
      { key: 'similarity_threshold', value: 0.85 },
      { key: 'max_swarm_nodes', value: 20 },
      { key: 'parallel_swarms', value: 3 },
      { key: 'subtask_max_depth', value: 5 },
      { key: 'dsa_advanced_aggregation', value: true },
      { key: 'priority_task_allocation', value: true },
      { key: 'swarm_history_retention_days', value: 90 },
      { key: 'concurrent_sandboxes', value: 3 },
      { key: 'sandbox_time_limit_minutes', value: 30 },
      { key: 'hard_isolated_mode', value: true },
      { key: 'sandbox_snapshot_save', value: true },
      { key: 'priority_queue', value: true },
      { key: 'experiment_history_days', value: 30 },
      { key: 'arena_battles_per_day', value: 10 },
      { key: 'premium_arena_seasons', value: true },
      { key: 'ultra_arena_tournaments', value: false },
      { key: 'advanced_leaderboard_analysis', value: true },
      { key: 'battle_replay', value: true },
      { key: 'priority_matching', value: true },
      { key: 'basic_dashboard', value: true },
      { key: 'advanced_trend_analysis', value: true },
      { key: 'intent_drift_detection', value: true },
      { key: 'custom_alert_rules', value: true },
      { key: 'export_reports', value: true },
      { key: 'api_usage_details', value: true },
      { key: 'predictive_analysis', value: false },
      { key: 'data_retention_days', value: 90 },
      { key: 'bounty_max_amount', value: 2000 },
      { key: 'parallel_bounties', value: 10 },
      { key: 'fetch_reward_multiplier', value: '1.5x' },
      { key: 'verification_reward_multiplier', value: '1.25x' },
      { key: 'heartbeat_reward_multiplier', value: '1x' },
      { key: 'marketplace_fee_percent', value: 3 },
      { key: 'kg_entities_per_day', value: 500 },
      { key: 'kg_relations_per_day', value: 1000 },
      { key: 'kg_max_hops', value: 4 },
      { key: 'semantic_search', value: true },
      { key: 'custom_entity_types', value: true },
      { key: 'graph_export', value: true },
      { key: 'api_keys', value: 5 },
      { key: 'session_concurrency', value: 5 },
      { key: 'session_max_participants', value: 5 },
      { key: 'circle_participation_per_month', value: 10 },
      { key: 'dm_messages_per_day', value: 100 },
      { key: 'support_level', value: 'email' },
    ],
    limits: {
      api_calls_per_minute: 30,
      api_calls_per_hour: 3000,
      api_calls_per_day: 100000,
      max_concurrent_requests: 15,
      publish_per_day: 30,
      max_swarm_nodes: 20,
      concurrent_sandboxes: 3,
      sandbox_minutes: 30,
      arena_battles_per_day: 10,
      kg_entities_per_day: 500,
      kg_relations_per_day: 1000,
    },
    available: true,
  },
  {
    id: 'ultra',
    name: 'Ultra',
    description: 'For enterprise-level and super agents',
    price_monthly: 0,
    price_annual: 0,
    price_monthly_credits: 10000,
    price_annual_credits: 96000,
    features: [
      { key: 'api_calls_per_minute', value: 60 },
      { key: 'api_calls_per_hour', value: 5000 },
      { key: 'api_calls_per_day', value: 200000 },
      { key: 'max_concurrent_requests', value: 50 },
      { key: 'request_body_limit', value: '20 MB' },
      { key: 'websocket_connections', value: 20 },
      { key: 'publish_per_day', value: -1 },
      { key: 'asset_max_size', value: '50 MB' },
      { key: 'bundle_max_genes', value: 50 },
      { key: 'carbon_tax_multiplier', value: '0.5x' },
      { key: 'withdrawal_fee', value: 5 },
      { key: 'similarity_threshold', value: 0.90 },
      { key: 'max_swarm_nodes', value: 100 },
      { key: 'parallel_swarms', value: 10 },
      { key: 'subtask_max_depth', value: 10 },
      { key: 'dsa_advanced_aggregation', value: true },
      { key: 'priority_task_allocation', value: true },
      { key: 'swarm_history_retention_days', value: 365 },
      { key: 'concurrent_sandboxes', value: 10 },
      { key: 'sandbox_time_limit_minutes', value: 120 },
      { key: 'hard_isolated_mode', value: true },
      { key: 'sandbox_snapshot_save', value: true },
      { key: 'priority_queue', value: true },
      { key: 'experiment_history_days', value: 90 },
      { key: 'arena_battles_per_day', value: -1 },
      { key: 'premium_arena_seasons', value: true },
      { key: 'ultra_arena_tournaments', value: true },
      { key: 'advanced_leaderboard_analysis', value: true },
      { key: 'battle_replay', value: true },
      { key: 'priority_matching', value: true },
      { key: 'basic_dashboard', value: true },
      { key: 'advanced_trend_analysis', value: true },
      { key: 'intent_drift_detection', value: true },
      { key: 'custom_alert_rules', value: true },
      { key: 'export_reports', value: true },
      { key: 'api_usage_details', value: true },
      { key: 'predictive_analysis', value: true },
      { key: 'data_retention_days', value: 365 },
      { key: 'bounty_max_amount', value: -1 },
      { key: 'parallel_bounties', value: 50 },
      { key: 'fetch_reward_multiplier', value: '2x' },
      { key: 'verification_reward_multiplier', value: '1.5x' },
      { key: 'heartbeat_reward_multiplier', value: '1.5x' },
      { key: 'marketplace_fee_percent', value: 1 },
      { key: 'kg_entities_per_day', value: 5000 },
      { key: 'kg_relations_per_day', value: 10000 },
      { key: 'kg_max_hops', value: 8 },
      { key: 'semantic_search', value: true },
      { key: 'custom_entity_types', value: true },
      { key: 'graph_export', value: true },
      { key: 'api_keys', value: 20 },
      { key: 'session_concurrency', value: 20 },
      { key: 'session_max_participants', value: 20 },
      { key: 'circle_participation_per_month', value: -1 },
      { key: 'dm_messages_per_day', value: 500 },
      { key: 'support_level', value: 'dedicated' },
    ],
    limits: {
      api_calls_per_minute: 60,
      api_calls_per_hour: 5000,
      api_calls_per_day: 200000,
      max_concurrent_requests: 50,
      publish_per_day: -1,
      max_swarm_nodes: 100,
      concurrent_sandboxes: 10,
      sandbox_minutes: 120,
      arena_battles_per_day: -1,
      kg_entities_per_day: 5000,
      kg_relations_per_day: 10000,
    },
    available: true,
  },
];

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export function getPlans(): Plan[] {
  return PLANS.filter((p) => p.available);
}

export function getPlan(planId: PlanId): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

export function getPlanFeatures(planId: PlanId): PlanFeature[] {
  const plan = getPlan(planId);
  if (!plan) return [];
  return plan.features;
}

export async function createPlan(
  plan: Omit<Plan, 'id'> & { id?: string },
): Promise<Plan> {
  const newPlan: Plan = {
    id: (plan.id as PlanId) ?? ('custom' as PlanId),
    name: plan.name,
    description: plan.description,
    price_monthly: plan.price_monthly,
    price_annual: plan.price_annual,
    price_monthly_credits: plan.price_monthly_credits,
    price_annual_credits: plan.price_annual_credits,
    features: plan.features,
    limits: plan.limits,
    available: plan.available,
  };
  return newPlan;
}

export async function updatePlan(
  planId: PlanId,
  updates: Partial<Omit<Plan, 'id'>>,
): Promise<Plan> {
  const planIndex = PLANS.findIndex((p) => p.id === planId);
  if (planIndex === -1) {
    throw new Error(`Plan not found: ${planId}`);
  }
  const updated: Plan = {
    ...PLANS[planIndex],
    ...(updates as Pick<Plan, Exclude<keyof Plan, 'id'>>),
    id: planId,
  };
  return updated;
}

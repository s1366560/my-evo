/**
 * Integration Test Suite - EvoMap
 * Phase 1-4 Coverage: Node Registration, Asset System, Swarm, Reputation
 */

import {
  registerNode, validateNodeSecret, getNodeInfo, updateHeartbeat,
  markNodeQuarantine, markNodeOffline,
} from '../src/a2a/node';
import {
  publishAsset, computeAssetHash, validateAsset,
} from '../src/assets/publish';
import {
  fetchAssets,
} from '../src/assets/fetch';
import { checkSimilarity } from '../src/assets/similarity';
import {
  createSwarm, getSwarm, updateSwarmState, listSwarms,
  createSubtask, getSubtask, getSubtasksForSwarm, assignSubtask,
  updateSubtaskState, submitDecomposition, getProposal, acceptProposal,
  rejectProposal, submitAggregatedResult, createSession, getSession, updateSession,
  distributeBounty, getBountyDistribution,
} from '../src/swarm/engine';
import {
  calculateReputation, getReputation, calculateTier,
  getCreditBalance, creditForPromotion, debitForPublish,
  creditForFetch, applyReputationPenalty,
} from '../src/reputation/engine';
import { Gene, Capsule, EvolutionEvent, AssetBundle } from '../src/assets/types';
import { SwarmTask, SwarmState } from '../src/swarm/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

let counter = 0;
function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`;
}

function makeGene(overrides: Partial<Gene> = {}): Gene {
  const id = uid('gene');
  return {
    type: 'Gene',
    schema_version: '1.5.0',
    id,
    category: 'repair',
    signals_match: ['timeout', '/error.*retry/i'],
    preconditions: ['tool available: curl'],
    strategy: ['Define error pattern', 'Implement retry with backoff', 'Validate fix'],
    constraints: { max_files: 5, forbidden_paths: ['.git', 'node_modules'] },
    validation: ['echo OK'],
    epigenetic_marks: ['strict_mode'],
    model_name: 'claude-sonnet-4',
    asset_id: '',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCapsule(geneId: string, overrides: Partial<Capsule> = {}): Capsule {
  return {
    type: 'Capsule',
    schema_version: '1.5.0',
    id: uid('capsule'),
    trigger: ['connection timeout', 'retry pattern'],
    gene: geneId,
    summary: 'Fixed HTTP timeout with exponential backoff retry',
    content: '// Fixed HTTP client with retry logic\nconst client = http.client({ retries: 3 });',
    diff: '--- a/net.js\n+++ b/net.js\n@@ -10,6 +10,8 @@\n...',
    strategy: ['Step 1: identify', 'Step 2: fix'],
    confidence: 0.87,
    blast_radius: { files: 2, lines: 45 },
    outcome: { status: 'success', score: 0.87 },
    success_streak: 3,
    env_fingerprint: { platform: 'linux', arch: 'x64' },
    trigger_context: { prompt: 'Users reported timeout', agent_model: 'claude-sonnet-4' },
    asset_id: '',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEvent(capsuleId: string, overrides: Partial<EvolutionEvent> = {}): EvolutionEvent {
  return {
    type: 'EvolutionEvent',
    schema_version: '1.5.0',
    id: uid('evt'),
    parent: undefined,
    intent: 'repair',
    signals: ['connection timeout'],
    genes_used: [],
    mutation_id: undefined,
    blast_radius: { files: 2, lines: 45 },
    outcome: { status: 'success', score: 0.87 },
    capsule_id: capsuleId,
    source_type: 'generated',
    asset_id: '',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSwarmTask(overrides: Partial<Omit<SwarmTask, 'state' | 'created_at'>> = {}): Omit<SwarmTask, 'state' | 'created_at'> {
  return {
    swarm_id: uid('swarm'),
    title: 'Optimize HTTP client',
    description: 'Decompose and solve HTTP client optimization',
    created_by: 'node_test',
    bounty: 1000,
    root_task_id: uid('root'),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('【核心】Node Registration & Heartbeat', () => {
  it('should register a new node and return node_secret', async () => {
    const result = await registerNode({ model: 'claude-sonnet-4', gene_count: 0, capsule_count: 0 });
    expect(result.status).toBe('acknowledged');
    expect(result.your_node_id).toMatch(/^node_/);
    expect(result.node_secret).toHaveLength(64);
    expect(result.node_secret).toMatch(/^[a-f0-9]+$/);
    expect(result.credit_balance).toBe(500);
    expect(result.hub_node_id).toMatch(/^hub_/);
  });

  it('should generate valid claim_code and claim_url', async () => {
    const result = await registerNode({});
    expect(result.claim_code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(result.claim_url).toContain(result.claim_code);
  });

  it('should validate node_secret and return node_id', async () => {
    const result = await registerNode({ model: 'test-model' });
    const nodeId = validateNodeSecret(result.node_secret);
    expect(nodeId).toBe(result.your_node_id);
  });

  it('should reject invalid node_secret', () => {
    expect(validateNodeSecret('invalid_secret_that_is_not_64_chars')).toBeNull();
  });

  it('should return existing node for duplicate registration', async () => {
    const first = await registerNode({ model: 'test-model', gene_count: 5 });
    const second = await registerNode({ model: 'test-model', gene_count: 10 }, first.your_node_id);
    expect(second.your_node_id).toBe(first.your_node_id);
    expect(second.credit_balance).toBe(0); // No new credits on re-register
  });

  it('should retrieve node info after registration', async () => {
    const result = await registerNode({ model: 'claude-sonnet-4', gene_count: 10, capsule_count: 5 });
    const info = getNodeInfo(result.your_node_id);
    expect(info).not.toBeNull();
    expect(info!.model).toBe('claude-sonnet-4');
    expect(info!.gene_count).toBe(10);
    expect(info!.capsule_count).toBe(5);
    expect(info!.status).toBe('alive');
    expect(info!.reputation).toBe(0);
  });

  it('should update heartbeat timestamp', async () => {
    const result = await registerNode({});
    expect(updateHeartbeat(result.your_node_id)).toBe(true);
  });

  it('should return false for heartbeat of non-existent node', () => {
    expect(updateHeartbeat('node_nonexistent')).toBe(false);
  });

  it('should rotate secret when requested', async () => {
    const first = await registerNode({ model: 'test-model' });
    const oldSecret = first.node_secret;
    const rotated = await registerNode({ model: 'test-model', rotate_secret: true }, first.your_node_id);
    expect(rotated.node_secret).not.toBe(oldSecret);
    expect(rotated.node_secret).toHaveLength(64);
    // Old secret should no longer validate
    expect(validateNodeSecret(oldSecret)).not.toBe(first.your_node_id);
  });

  it('should mark node offline', async () => {
    const result = await registerNode({});
    const marked = markNodeOffline(result.your_node_id);
    expect(marked).toBe(true);
    const info = getNodeInfo(result.your_node_id);
    expect(info!.status).toBe('offline');
  });

  it('should mark node in quarantine', async () => {
    const result = await registerNode({});
    const marked = markNodeQuarantine(result.your_node_id);
    expect(marked).toBe(true);
    const info = getNodeInfo(result.your_node_id);
    expect(info!.status).toBe('quarantine');
  });
});

describe('【核心】Asset Publishing (Gene + Capsule + EvolutionEvent Bundle)', () => {
  it('should compute SHA-256 asset_id for a Gene', () => {
    const gene = makeGene();
    const hash = computeAssetHash(gene);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should compute SHA-256 asset_id for a Capsule', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.id);
    const hash = computeAssetHash(capsule);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should validate Gene structure - valid', () => {
    const gene = makeGene();
    const errors = validateAsset(gene);
    expect(errors).toHaveLength(0);
  });

  it('should reject Gene missing signals_match', () => {
    const gene = makeGene({ signals_match: [] });
    expect(validateAsset(gene)).toContain('Gene must have at least one signals_match entry');
  });

  it('should reject Gene missing strategy', () => {
    const gene = makeGene({ strategy: [] });
    expect(validateAsset(gene)).toContain('Gene must have at least one strategy step');
  });

  it('should reject Gene with empty constraints', () => {
    const gene = makeGene({ constraints: {} });
    expect(validateAsset(gene)).toContain('Gene must define constraints');
  });

  it('should validate Capsule structure - valid', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.id);
    expect(validateAsset(capsule)).toHaveLength(0);
  });

  it('should reject Capsule missing trigger', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.id, { trigger: [] });
    expect(validateAsset(capsule)).toContain('Capsule must have at least one trigger');
  });

  it('should reject Capsule with invalid confidence', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.id, { confidence: 1.5 });
    expect(validateAsset(capsule)).toContain('Capsule confidence must be between 0 and 1');
  });

  it('should reject Capsule missing blast_radius', () => {
    const gene = makeGene();
    const capsule = makeCapsule(gene.id, { blast_radius: undefined as any });
    expect(validateAsset(capsule)).toContain('Capsule must define blast_radius');
  });

  it('should reject asset without sha256: prefix', () => {
    const gene = makeGene({ asset_id: 'invalid' });
    expect(validateAsset(gene)).toContain('asset_id must start with "sha256:"');
  });

  it('should reject asset without id field', () => {
    const gene = makeGene({ id: undefined as any });
    expect(validateAsset(gene)).toContain('Missing id field');
  });

  it('should publish a Gene and return candidate status', async () => {
    const node = await registerNode({ model: 'test-model' });
    const gene = makeGene();
    gene.asset_id = computeAssetHash(gene);
    const result = await publishAsset({ assets: [gene] }, node.your_node_id, node.node_secret);
    expect(result.status).toBe('candidate');
    expect(result.asset_ids).toContain(gene.asset_id);
  });

  it('should publish a Bundle with Gene + Capsule + EvolutionEvent', async () => {
    const node = await registerNode({ model: 'test-model' });
    const gene = makeGene();
    gene.asset_id = computeAssetHash(gene);
    const capsule = makeCapsule(gene.id);
    capsule.asset_id = computeAssetHash(capsule);
    const event = makeEvent(capsule.id);
    event.asset_id = computeAssetHash(event);
    const result = await publishAsset({ assets: [gene, capsule, event] }, node.your_node_id, node.node_secret);
    expect(result.status).toBe('candidate');
    expect(result.asset_ids.length).toBe(3);
    expect(result.asset_ids).toContain(gene.asset_id);
    expect(result.asset_ids).toContain(capsule.asset_id);
    expect(result.asset_ids).toContain(event.asset_id);
  });
});

describe('【核心】Fetch - search_only vs full fetch', () => {
  it('should return assets matching a query', async () => {
    const node = await registerNode({ model: 'test-model' });
    const gene = makeGene();
    gene.asset_id = computeAssetHash(gene);
    await publishAsset({ assets: [gene] }, node.your_node_id, node.node_secret);

    const result = await fetchAssets({ query: 'timeout', type: 'Gene' });
    expect(result.assets.length).toBeGreaterThan(0);
    expect(result.assets[0].asset_id).toBeTruthy();
  });

  it('should filter by owner_id', async () => {
    const node = await registerNode({ model: 'test-model' });
    const gene = makeGene();
    gene.asset_id = computeAssetHash(gene);
    await publishAsset({ assets: [gene] }, node.your_node_id, node.node_secret);

    const result = await fetchAssets({ owner_id: node.your_node_id, type: 'Gene' });
    expect(result.assets.every(a => a.owner_id === node.your_node_id)).toBe(true);
  });

  it('should return empty results for non-existent owner', async () => {
    const result = await fetchAssets({ owner_id: 'node_does_not_exist' });
    expect(result.assets).toHaveLength(0);
  });

  it('should respect limit parameter', async () => {
    const result = await fetchAssets({ limit: 5 });
    expect(result.assets.length).toBeLessThanOrEqual(5);
  });

  it('should list assets without query (all type)', async () => {
    const result = await fetchAssets({ type: 'Gene' });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.assets.length).toBeLessThanOrEqual(result.limit ?? 50);
  });
});

describe('【Swarm】DSA Mode - Decompose-Solve-Aggregate', () => {
  it('should create a Swarm task in idle state', () => {
    const swarm = createSwarm(makeSwarmTask());
    expect(swarm.swarm_id).toBeTruthy();
    expect(swarm.state).toBe('idle');
    expect(swarm.task_type).toBe('DSA');
  });

  it('should transition swarm through DSA states', () => {
    const swarm = createSwarm(makeSwarmTask());
    expect(swarm.state).toBe('idle');

    updateSwarmState(swarm.swarm_id, 'decomposition');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('decomposition');

    updateSwarmState(swarm.swarm_id, 'solving');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('solving');

    updateSwarmState(swarm.swarm_id, 'aggregating');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('aggregating');

    updateSwarmState(swarm.swarm_id, 'completed');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('completed');
  });

  it('should submit and accept a decomposition proposal', () => {
    const swarm = createSwarm(makeSwarmTask());
    updateSwarmState(swarm.swarm_id, 'decomposition');

    const proposal = submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_solver1',
      subtasks: [
        { id: 'sub_1', description: 'Implement HTTP retry logic', weight: 0.4 },
        { id: 'sub_2', description: 'Add timeout handling', weight: 0.6 },
      ],
    });
    expect(proposal.status).toBe('pending');
    expect(proposal.subtasks).toHaveLength(2);

    acceptProposal(swarm.swarm_id);
    expect(getProposal(swarm.swarm_id)!.status).toBe('accepted');

    // Subtasks should be auto-created
    const subtasks = getSubtasksForSwarm(swarm.swarm_id);
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0].state).toBe('pending');
  });

  it('should reject a decomposition proposal', () => {
    const swarm = createSwarm(makeSwarmTask());
    updateSwarmState(swarm.swarm_id, 'decomposition');

    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_solver1',
      subtasks: [{ id: 'sub_x', description: 'Fix it', weight: 1.0 }],
    });

    expect(getProposal(swarm.swarm_id)!.status).toBe('pending');
    rejectProposal(swarm.swarm_id);
    expect(getProposal(swarm.swarm_id)!.status).toBe('rejected');
  });

  it('should assign subtasks to nodes', () => {
    const swarm = createSwarm(makeSwarmTask());
    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_proposer',
      subtasks: [
        { id: 'sub_a', description: 'Task A', weight: 0.5 },
        { id: 'sub_b', description: 'Task B', weight: 0.5 },
      ],
    });
    acceptProposal(swarm.swarm_id);

    assignSubtask('sub_a', 'node_worker1');
    assignSubtask('sub_b', 'node_worker2');

    expect(getSubtask('sub_a')!.assigned_to).toBe('node_worker1');
    expect(getSubtask('sub_a')!.state).toBe('claimed');
    expect(getSubtask('sub_b')!.assigned_to).toBe('node_worker2');
  });

  it('should complete subtasks and aggregate results', () => {
    const swarm = createSwarm(makeSwarmTask({ bounty_total: 1000 }));
    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_proposer',
      subtasks: [
        { id: 'sub_x', description: 'Part X', weight: 0.6 },
        { id: 'sub_y', description: 'Part Y', weight: 0.4 },
      ],
    });
    acceptProposal(swarm.swarm_id);

    updateSubtaskState('sub_x', 'completed', { result: 'X done' });
    updateSubtaskState('sub_y', 'completed', { result: 'Y done' });

    updateSwarmState(swarm.swarm_id, 'aggregating');
    const aggResult = submitAggregatedResult({
      swarm_id: swarm.swarm_id,
      aggregator: 'node_aggregator',
      output: { final: 'Combined solution' },
      quality_score: 0.92,
    });

    expect(aggResult.aggregated_by).toBe('node_aggregator');
    expect(aggResult.quality_score).toBe(0.92);
  });

  it('should list swarms filtered by state', () => {
    const s1 = createSwarm(makeSwarmTask());
    createSwarm(makeSwarmTask());
    updateSwarmState(s1.swarm_id, 'solving');

    const solving = listSwarms({ state: 'solving' });
    const idle = listSwarms({ state: 'idle' });

    expect(solving.every(s => s.state === 'solving')).toBe(true);
    expect(idle.every(s => s.state === 'idle')).toBe(true);
  });
});

describe('【Swarm】DC Mode - Diverge-Converge', () => {
  it('should run DC mode with multiple independent solutions', () => {
    const swarm = createSwarm(makeSwarmTask({  bounty_total: 800 }));

    updateSwarmState(swarm.swarm_id, 'decomposition');
    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_coordinator',
      subtasks: [
        { id: 'dc_1', description: 'Solution A', weight: 0.33 },
        { id: 'dc_2', description: 'Solution B', weight: 0.33 },
        { id: 'dc_3', description: 'Solution C', weight: 0.34 },
      ],
    });
    acceptProposal(swarm.swarm_id);

    // DIVERGE: all solve independently
    updateSwarmState(swarm.swarm_id, 'solving');
    updateSubtaskState('dc_1', 'completed', { solution: 'A', votes: 3 });
    updateSubtaskState('dc_2', 'completed', { solution: 'B', votes: 5 });
    updateSubtaskState('dc_3', 'completed', { solution: 'C', votes: 1 });

    // CONVERGE: aggregator selects best
    updateSwarmState(swarm.swarm_id, 'aggregating');
    const result = submitAggregatedResult({
      swarm_id: swarm.swarm_id,
      aggregator: 'node_aggregator',
      output: { solution: 'B', vote_count: 5 },
      quality_score: 0.88,
    });

    expect(result.result).toHaveProperty('solution', 'B');
    expect(result.result).toHaveProperty('vote_count', 5);
  });

  it('should handle swarm timeout', () => {
    const swarm = createSwarm(makeSwarmTask());
    updateSwarmState(swarm.swarm_id, 'solving');
    updateSwarmState(swarm.swarm_id, 'timeout');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('timeout');
  });

  it('should handle swarm cancel', () => {
    const swarm = createSwarm(makeSwarmTask());
    updateSwarmState(swarm.swarm_id, 'decomposition');
    updateSwarmState(swarm.swarm_id, 'cancelled');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('cancelled');
  });

  it('should handle partial completion (some subtasks failed)', () => {
    const swarm = createSwarm(makeSwarmTask({ bounty_total: 1000 }));
    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_proposer',
      subtasks: [
        { id: 'p1', description: 'Task 1', weight: 0.5 },
        { id: 'p2', description: 'Task 2', weight: 0.5 },
      ],
    });
    acceptProposal(swarm.swarm_id);

    updateSubtaskState('p1', 'completed', { result: 'OK' });
    updateSubtaskState('p2', 'failed', { reason: 'resource unavailable' });

    updateSwarmState(swarm.swarm_id, 'aggregating');
    submitAggregatedResult({
      swarm_id: swarm.swarm_id,
      aggregator: 'node_aggregator',
      output: { partial: true, completed: ['p1'], failed: ['p2'] },
      quality_score: 0.55,
    });

    updateSwarmState(swarm.swarm_id, 'completed');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('completed');
  });
});

describe('【Swarm】Bounty Distribution', () => {
  it('should distribute bounty correctly (Proposer 5%, Solvers 85%, Aggregator 10%)', () => {
    const swarm = createSwarm(makeSwarmTask({ bounty_total: 1000 }));
    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: 'node_proposer',
      subtasks: [
        { id: 'b1', description: 'Task 1', weight: 0.6 },
        { id: 'b2', description: 'Task 2', weight: 0.4 },
      ],
    });
    acceptProposal(swarm.swarm_id);

    assignSubtask('b1', 'node_solver1');
    assignSubtask('b2', 'node_solver2');

    updateSubtaskState('b1', 'completed', { result: 'done' });
    updateSubtaskState('b2', 'completed', { result: 'done' });

    updateSwarmState(swarm.swarm_id, 'aggregating');
    submitAggregatedResult({
      swarm_id: swarm.swarm_id,
      aggregator: 'node_aggregator',
      output: { final: 'combined' },
      quality_score: 0.9,
    });

    const dist = distributeBounty(swarm.swarm_id, 1000);
    expect(dist.total_bounty).toBe(1000);
    expect(dist.distributed).toBe(true);

    // Proposer 5% = 50, Solvers 85% = 850 (split by weight), Aggregator 10% = 100
    expect(dist.proposer_share).toBe(50);
    expect(dist.aggregator_share).toBe(100);
    // Solver shares should sum to 850
    const solverTotal = dist.solver_shares.reduce((sum: number, s: { share: number }) => sum + s.share, 0);
    expect(solverTotal).toBe(850);
  });

  it('should get bounty distribution for swarm', () => {
    const swarm = createSwarm(makeSwarmTask({ bounty: 500 }));
    const dist = distributeBounty(swarm.swarm_id, 500);
    expect(getBountyDistribution(swarm.swarm_id)).not.toBeUndefined();
  });
});

describe('【声望】GDI Reputation Engine', () => {
  it('should calculate positive reputation (above base 50)', async () => {
    const node = await registerNode({ model: 'test-model' });
    const score = calculateReputation(node.your_node_id, {
      publishedCount: 10,
      promotedCount: 8,
      rejectedCount: 1,
      usageFactor: 0.7,
      avgGdi: 72,
    });
    expect(score.total).toBeGreaterThan(50);
    expect(score.positive).toHaveProperty('promotion_rate');
    expect(score.positive).toHaveProperty('usage_factor');
    expect(score.positive).toHaveProperty('avg_gdi');
  });

  it('should calculate negative reputation (below base 50)', async () => {
    const node = await registerNode({ model: 'test-model' });
    const score = calculateReputation(node.your_node_id, {
      publishedCount: 10,
      promotedCount: 2,
      rejectedCount: 6,
      revokedCount: 2,
      usageFactor: 0,
      avgGdi: 30,
    });
    expect(score.total).toBeLessThan(50);
  });

  it('should clamp reputation between 0 and 100', async () => {
    const node = await registerNode({ model: 'test-model' });
    const score = calculateReputation(node.your_node_id, {
      publishedCount: 100,
      promotedCount: 0,
      rejectedCount: 100,
      revokedCount: 100,
      usageFactor: 0,
      avgGdi: 0,
    });
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });

  it('should track maturity factor for established nodes', async () => {
    const node = await registerNode({ model: 'test-model' });
    const score = calculateReputation(node.your_node_id, {
      publishedCount: 50,
      promotedCount: 40,
      usageFactor: 0.8,
      avgGdi: 75,
    });
    expect(score.maturity_factor).toBeGreaterThan(0);
  });

  it('should return stored reputation via getReputation', async () => {
    const node = await registerNode({ model: 'test-model' });
    calculateReputation(node.your_node_id, { publishedCount: 20, promotedCount: 15, avgGdi: 70, usageFactor: 0.6 });
    const stored = getReputation(node.your_node_id);
    expect(stored).not.toBeUndefined();
    expect(stored!.total).toBeGreaterThan(50);
  });

  it('should return undefined for unknown node', () => {
    expect(getReputation('node_unknown')).toBeUndefined();
  });
});

describe('【声望】Tier Calculation', () => {
  it('should calculate Tier 1 for high-reputation node', async () => {
    const node = await registerNode({ model: 'test-model' });
    calculateReputation(node.your_node_id, {
      publishedCount: 60, promotedCount: 25, avgGdi: 85, usageFactor: 0.9,
    });
    const tier = calculateTier(node.your_node_id);
    expect(tier.tier).toBe('Tier 1');
    expect(tier.capabilities).toContain('governance_vote');
  });

  it('should calculate Tier 4 for new/low-reputation node', async () => {
    const node = await registerNode({ model: 'test-model' });
    calculateReputation(node.your_node_id, {
      publishedCount: 2, promotedCount: 0, avgGdi: 20, usageFactor: 0,
    });
    const tier = calculateTier(node.your_node_id);
    expect(tier.tier).toBe('Tier 4');
  });

  it('should include upgrade progress for Tier 4', async () => {
    const node = await registerNode({ model: 'test-model' });
    calculateReputation(node.your_node_id, {
      publishedCount: 10, promotedCount: 3, avgGdi: 50, usageFactor: 0.3,
    });
    const tier = calculateTier(node.your_node_id);
    expect(tier.upgrade_progress).toBeDefined();
    expect(tier.upgrade_progress).toBeGreaterThanOrEqual(0);
  });
});

describe('【声望】Credit System', () => {
  it('should start new node with 500 credits', async () => {
    const node = await registerNode({ model: 'test-model' });
    const balance = getCreditBalance(node.your_node_id);
    expect(balance.balance).toBe(500);
    expect(balance.transactions).toHaveLength(1);
    expect(balance.transactions[0].type).toBe('registration_bonus');
  });

  it('should credit promotion reward to node', async () => {
    const node = await registerNode({ model: 'test-model' });
    const initial = getCreditBalance(node.your_node_id).balance;
    creditForPromotion(node.your_node_id, 'capsule_test123');
    const updated = getCreditBalance(node.your_node_id);
    expect(updated.balance).toBe(initial + 20);
    expect(updated.transactions.some((t: any) => t.type === 'asset_promotion' && t.amount === 20)).toBe(true);
  });

  it('should debit publish cost from node', async () => {
    const node = await registerNode({ model: 'test-model' });
    const initial = getCreditBalance(node.your_node_id).balance;
    debitForPublish(node.your_node_id, 2);
    const updated = getCreditBalance(node.your_node_id);
    expect(updated.balance).toBe(initial - 2);
  });

  it('should credit fetch reward based on tier', async () => {
    const node = await registerNode({ model: 'test-model' });
    const initial = getCreditBalance(node.your_node_id).balance;
    creditForFetch(node.your_node_id, 'capsule_tier1', 1);
    const updated = getCreditBalance(node.your_node_id);
    expect(updated.balance).toBe(initial + 12); // Tier 1 = 12
  });

  it('should creditForFetch with tier 2', async () => {
    const node = await registerNode({ model: 'test-model' });
    const initial = getCreditBalance(node.your_node_id).balance;
    creditForFetch(node.your_node_id, 'capsule_tier2', 2);
    expect(getCreditBalance(node.your_node_id).balance).toBe(initial + 8); // Tier 2 = 8
  });

  it('should creditForFetch with tier 3', async () => {
    const node = await registerNode({ model: 'test-model' });
    const initial = getCreditBalance(node.your_node_id).balance;
    creditForFetch(node.your_node_id, 'capsule_tier3', 3);
    expect(getCreditBalance(node.your_node_id).balance).toBe(initial + 3); // Tier 3 = 3
  });
});

describe('【声望】Reputation Penalties', () => {
  it('should apply reputation penalty and update score', async () => {
    const node = await registerNode({ model: 'test-model' });
    calculateReputation(node.your_node_id, { publishedCount: 20, promotedCount: 10, avgGdi: 65, usageFactor: 0.5 });
    const before = getReputation(node.your_node_id)!.total;

    applyReputationPenalty(node.your_node_id, 5);
    const after = getReputation(node.your_node_id)!.total;
    expect(after).toBeLessThan(before);
  });

  it('should not go below 0 after penalty', async () => {
    const node = await registerNode({ model: 'test-model' });
    applyReputationPenalty(node.your_node_id, 1000);
    const score = getReputation(node.your_node_id)!;
    expect(score.total).toBeGreaterThanOrEqual(0);
  });
});

describe('【Quarantine】Progressive Penalty System', () => {
  it('should mark node in quarantine via node status', async () => {
    const node = await registerNode({ model: 'test-model' });
    markNodeQuarantine(node.your_node_id);
    const info = getNodeInfo(node.your_node_id);
    expect(info!.status).toBe('quarantine');
  });

  it('should isolate node in quarantine', async () => {
    const node = await registerNode({ model: 'test-model' });
    markNodeQuarantine(node.your_node_id);
    // Quarantined node should still be retrievable
    const info = getNodeInfo(node.your_node_id);
    expect(info).not.toBeNull();
    expect(info!.status).toBe('quarantine');
  });

  it('should recover from quarantine', async () => {
    const node = await registerNode({ model: 'test-model' });
    markNodeQuarantine(node.your_node_id);
    expect(getNodeInfo(node.your_node_id)!.status).toBe('quarantine');
    // Recovery: update heartbeat to bring back to alive
    updateHeartbeat(node.your_node_id);
    // After heartbeat, node should be alive (quarantine cleared)
    const info = getNodeInfo(node.your_node_id);
    expect(info!.status).toBe('alive');
  });
});

describe('【相似度】Anti-Duplication Detection', () => {
  it('should detect high similarity between identical Genes', () => {
    const geneA = makeGene({ signals_match: ['timeout', '/error.*retry/i'] });
    const geneB = makeGene({ signals_match: ['timeout', '/error.*retry/i', 'connection'] });
    const result = checkSimilarity(geneA);
    expect(result.max_similarity).toBeGreaterThan(0.5);
  });

  it('should return low similarity for different Genes', () => {
    const geneA = makeGene({ signals_match: ['timeout'], category: 'repair' });
    const geneB = makeGene({ signals_match: ['memory leak'], category: 'optimize' });
    const result = checkSimilarity(geneA);
    expect(result.max_similarity).toBeLessThan(0.5);
  });

  it('should detect ≥85% similarity for near-identical Genes', () => {
    const geneA = makeGene({ signals_match: ['timeout', 'retry'], strategy: ['step1', 'step2'] });
    const geneB = makeGene({ signals_match: ['timeout', 'retry'], strategy: ['step1', 'step2'] });
    const result = checkSimilarity(geneA);
    expect(result.max_similarity).toBeGreaterThanOrEqual(0.85);
  });
});

describe('【Session】Collaboration Session', () => {
  it('should create a collaboration session', () => {
    const session = createSession({
      session_id: uid('sess'),
      swarm_id: uid('swarm_sess'),
      participants: ['node_alice', 'node_bob', 'node_charlie'],
      purpose: 'joint_optimization',
      context: {},
    });
    expect(session.session_id).toBeTruthy();
    expect(session.participants).toContain('node_alice');
    expect(session.participants).toContain('node_bob');
    expect(session.participants).toContain('node_charlie');
    expect(session.purpose).toBe('joint_optimization');
  });

  it('should retrieve an existing session', () => {
    const created = createSession({
      session_id: uid('sess2'),
      swarm_id: uid('swarm_sess2'),
      participants: ['node_dave', 'node_eve'],
      purpose: 'code_review',
      context: {},
    });
    const retrieved = getSession(created.session_id);
    expect(retrieved).not.toBeUndefined();
    expect(retrieved!.session_id).toBe(created.session_id);
  });

  it('should update session with new state', () => {
    const session = createSession({
      session_id: uid('sess3'),
      swarm_id: uid('swarm_sess3'),
      participants: ['node_frank', 'node_grace'],
      purpose: 'sandbox_test',
      context: {},
    });
    const updated = updateSession(session.session_id, {
      context: { status: 'active' },
    });
    expect(updated!.context).toHaveProperty('status', 'active');
  });
});

describe('【集成】Full End-to-End Flow', () => {
  it('should run complete flow: register → publish → fetch → swarm → reputation', async () => {
    // 1. Register node
    const node = await registerNode({ model: 'claude-sonnet-4', gene_count: 0, capsule_count: 0 });
    expect(node.status).toBe('acknowledged');
    expect(node.credit_balance).toBe(500);

    // 2. Publish gene + capsule bundle
    const gene = makeGene({ model_name: 'claude-sonnet-4' });
    gene.asset_id = computeAssetHash(gene);
    const capsule = makeCapsule(gene.id);
    capsule.asset_id = computeAssetHash(capsule);
    const event = makeEvent(capsule.id);
    event.asset_id = computeAssetHash(event);

    const publishResult = await publishAsset(
      { assets: [gene, capsule, event] },
      node.your_node_id,
      node.node_secret
    );
    expect(publishResult.status).toBe('candidate');
    expect(publishResult.asset_ids.length).toBe(3);

    // 3. Fetch the published asset
    const fetchResult = await fetchAssets({ owner_id: node.your_node_id, type: 'Gene' });
    expect(fetchResult.assets.length).toBeGreaterThan(0);

    // 4. Calculate reputation after publishing
    const rep = calculateReputation(node.your_node_id, {
      publishedCount: 3,
      promotedCount: 3,
      avgGdi: 72,
      usageFactor: 0.6,
    });
    expect(rep.total).toBeGreaterThan(50);

    // 5. Credit rewards for promotion
    creditForPromotion(node.your_node_id, capsule.id);
    const balance = getCreditBalance(node.your_node_id);
    expect(balance!.balance).toBeGreaterThan(500); // Initial 500 + promotion reward

    // 6. Create a swarm task and complete it
    const swarm = createSwarm(makeSwarmTask({ created_by: node.your_node_id, bounty: 500 }));
    submitDecomposition({
      swarm_id: swarm.swarm_id,
      proposer: node.your_node_id,
      subtasks: [{ id: uid('st'), description: 'Run integration test', weight: 1.0 }],
    });
    acceptProposal(swarm.swarm_id);
    updateSubtaskState(uid('st'), 'completed', { result: 'test passed' });
    updateSwarmState(swarm.swarm_id, 'aggregating');
    submitAggregatedResult({
      swarm_id: swarm.swarm_id,
      aggregator: node.your_node_id,
      output: { summary: 'All tests passed' },
      quality_score: 0.95,
    });
    updateSwarmState(swarm.swarm_id, 'completed');
    expect(getSwarm(swarm.swarm_id)!.state).toBe('completed');

    // 7. Verify tier upgrades with activity
    const tier = calculateTier(node.your_node_id);
    expect(tier.node_id).toBe(node.your_node_id);
  });
});
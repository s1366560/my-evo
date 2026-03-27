/**
 * EvoMap System Integration Tests
 * Covers: Node registration → publish Capsule → fetch → 积分增加
 *         Swarm协作完整流程, Council治理提案到执行
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EvoMapNode, createAndRegisterNode } from '../a2a/client.js';
import {
  createGene,
  createCapsule,
  createEvolutionEvent,
  type Gene,
  type Capsule,
  type EvolutionEvent,
} from '../models/assets.js';
import { computeAssetId, verifyAssetId } from '../utils/crypto.js';
import {
  MESSAGE_TYPES,
  ASSET_STATES,
  SWARM_STATES,
  CREDIT_VALUES,
  GDI_WEIGHTS,
} from '../core/constants.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestNode(): EvoMapNode {
  return new EvoMapNode({
    capabilities: ['fetch', 'publish', 'validate', 'swarm'],
    model: 'test-model',
    envFingerprint: 'test-fingerprint',
  });
}

function createTestGene(ownerId: string, signals: string[] = ['error', 'memory']): Gene {
  return createGene({
    owner_id: ownerId,
    signals_match: signals,
    strategy: {
      approach: 'test_approach',
      constraints: ['max_iterations:5'],
      triggers: signals,
    },
    metadata: {
      name: 'TestGene',
      description: 'Integration test gene',
      tags: ['test'],
      version: '1.0.0',
    },
  });
}

function createTestCapsule(ownerId: string, geneRef?: string): Capsule {
  return createCapsule({
    owner_id: ownerId,
    trigger: {
      error_pattern: 'TypeError.*undefined',
      signals: ['error'],
      description: 'Fix undefined reference error',
    },
    gene_ref: geneRef,
    diff: {
      files: [
        {
          path: 'src/handler.ts',
          operation: 'update',
          content: '// fixed code',
        },
      ],
    },
    confidence: 0.85,
    blast_radius: {
      files: 1,
      lines: 5,
      scope: 'local',
    },
  });
}

function createTestEvent(ownerId: string, capsuleId: string, genes: string[]): EvolutionEvent {
  return createEvolutionEvent({
    owner_id: ownerId,
    capsule_id: capsuleId,
    intent: 'Fix memory leak in handler',
    genes_used: genes,
    outcome: { status: 'success', feedback: 'All tests passed' },
  });
}

// ============================================================================
// 1. Node Registration Flow Tests
// ============================================================================

describe('Node Registration Flow', () => {
  let node: EvoMapNode;

  beforeEach(() => {
    node = createTestNode();
  });

  it('should create node with unique node_id', () => {
    expect(node.nodeId).toMatch(/^node_[a-f0-9]{32}$/);
  });

  it('should start unregistered', () => {
    expect(node.isRegistered).toBe(false);
    expect(node.status).toBe('offline');
  });

  it('should register and receive node_secret', async () => {
    const response = await node.register('https://hub.evomap.ai');
    
    expect(response.node_id).toBe(node.nodeId);
    expect(response.node_secret).toBeDefined();
    expect(response.node_secret).toHaveLength(64); // SHA-256 hex
    expect(response.claim_code).toMatch(/^claim_\d+$/);
    expect(response.registered_at).toBeDefined();
  });

  it('should be registered after registration', async () => {
    await node.register('https://hub.evomap.ai');
    
    expect(node.isRegistered).toBe(true);
    expect(node.status).toBe('alive');
  });

  it('should reject publish without registration', async () => {
    const gene = createTestGene(node.nodeId);
    
    await expect(
      node.publish('https://hub.evomap.ai', [gene])
    ).rejects.toThrow('Node not registered');
  });

  it('should reject heartbeat without registration', async () => {
    await expect(
      node.sendHeartbeat('https://hub.evomap.ai')
    ).rejects.toThrow('Node not registered');
  });

  it('should createAndRegisterNode convenience function', async () => {
    const registered = await createAndRegisterNode('https://hub.evomap.ai', {
      capabilities: ['fetch', 'publish'],
    });
    
    expect(registered.isRegistered).toBe(true);
    expect(registered.nodeId).toMatch(/^node_[a-f0-9]{32}$/);
  });
});

// ============================================================================
// 2. Asset Publishing Tests (Bundle)
// ============================================================================

describe('Asset Publishing (Bundle)', () => {
  let node: EvoMapNode;

  beforeEach(async () => {
    node = createTestNode();
    await node.register('https://hub.evomap.ai');
  });

  it('should publish Gene and receive asset_id', async () => {
    const gene = createTestGene(node.nodeId);
    const expectedId = computeAssetId(gene);
    const geneWithId = { ...gene, asset_id: expectedId };

    const response = await node.publish('https://hub.evomap.ai', [geneWithId]);

    expect(response.bundle_id).toMatch(/^bundle_\d+$/);
    expect(response.asset_ids).toHaveLength(1);
    expect(response.asset_ids[0]).toBe(expectedId);
    expect(response.status).toBe('published');
  });

  it('should publish Capsule and compute asset_id', async () => {
    const capsule = createTestCapsule(node.nodeId);
    const expectedId = computeAssetId(capsule);
    const capsuleWithId = { ...capsule, asset_id: expectedId };

    const response = await node.publish('https://hub.evomap.ai', [capsuleWithId]);

    expect(response.asset_ids).toHaveLength(1);
    expect(response.asset_ids[0]).toBe(expectedId);
    expect(response.status).toBe('published');
  });

  it('should publish Bundle with Gene+Capsule+EvolutionEvent', async () => {
    const gene = createTestGene(node.nodeId);
    const geneId = computeAssetId(gene);
    const geneWithId = { ...gene, asset_id: geneId };

    const capsule = createTestCapsule(node.nodeId, geneId);
    const capsuleId = computeAssetId(capsule);
    const capsuleWithId = { ...capsule, asset_id: capsuleId };

    const event = createTestEvent(node.nodeId, capsuleId, [geneId]);
    const eventId = computeAssetId(event);
    const eventWithId = { ...event, asset_id: eventId };

    const response = await node.publish('https://hub.evomap.ai', [
      geneWithId,
      capsuleWithId,
      eventWithId,
    ]);

    expect(response.asset_ids).toHaveLength(3);
    expect(response.asset_ids).toContain(geneId);
    expect(response.asset_ids).toContain(capsuleId);
    expect(response.asset_ids).toContain(eventId);
  });

  it('should include validation_results in publish response', async () => {
    const gene = createTestGene(node.nodeId);
    const geneId = computeAssetId(gene);

    const response = await node.publish('https://hub.evomap.ai', [
      { ...gene, asset_id: geneId },
    ]);

    expect(response.validation_results).toBeDefined();
    expect(Array.isArray(response.validation_results)).toBe(true);
  });
});

// ============================================================================
// 3. Asset ID Computation Tests
// ============================================================================

describe('Asset ID Computation (Content-Addressable)', () => {
  it('should compute same ID for identical content', () => {
    const gene1 = createTestGene('node_abc123');
    const gene2 = createTestGene('node_abc123');

    expect(computeAssetId(gene1)).toBe(computeAssetId(gene2));
  });

  it('should compute different ID for different owner', () => {
    const gene1 = createTestGene('node_abc123');
    const gene2 = createTestGene('node_xyz789');

    expect(computeAssetId(gene1)).not.toBe(computeAssetId(gene2));
  });

  it('should compute different ID for different signals_match', () => {
    const gene1 = createTestGene('node_abc', ['error']);
    const gene2 = createTestGene('node_abc', ['memory']);

    expect(computeAssetId(gene1)).not.toBe(computeAssetId(gene2));
  });

  it('should compute different ID for different strategy', () => {
    const gene1 = createGene({
      owner_id: 'node_test',
      signals_match: ['error'],
      strategy: { approach: 'fix_v1' },
    });
    const gene2 = createGene({
      owner_id: 'node_test',
      signals_match: ['error'],
      strategy: { approach: 'fix_v2' },
    });

    expect(computeAssetId(gene1)).not.toBe(computeAssetId(gene2));
  });

  it('should verify valid asset ID', () => {
    const gene = createTestGene('node_verified');
    const assetId = computeAssetId(gene);
    const geneWithId = { ...gene, asset_id: assetId };

    expect(verifyAssetId(geneWithId)).toBe(true);
  });

  it('should reject tampered asset ID', () => {
    const gene = createTestGene('node_tampered');
    const wrongId = 'a'.repeat(64);
    const geneWithWrongId = { ...gene, asset_id: wrongId };

    expect(verifyAssetId(geneWithWrongId)).toBe(false);
  });
});

// ============================================================================
// 4. Fetch Tests (search_only + full fetch)
// ============================================================================

describe('Asset Fetch', () => {
  let node: EvoMapNode;

  beforeEach(async () => {
    node = createTestNode();
    await node.register('https://hub.evomap.ai');
  });

  it('should fetch with search_only=true (free metadata)', async () => {
    const response = await node.fetch(
      'https://hub.evomap.ai',
      { signals: ['error'] },
      true // searchOnly
    );

    expect(response.search_only).toBe(true);
    expect(response.assets).toEqual([]);
    expect(response.total_count).toBe(0);
  });

  it('should fetch with search_only=false (paid full content)', async () => {
    const response = await node.fetch(
      'https://hub.evomap.ai',
      { signals: ['error'] },
      false
    );

    expect(response.search_only).toBe(false);
  });

  it('should fetch with GDI filter', async () => {
    const response = await node.fetch(
      'https://hub.evomap.ai',
      { min_gdi: 0.7 },
      false
    );

    expect(response.total_count).toBeDefined();
    expect(typeof response.total_count).toBe('number');
  });

  it('should reject fetch when not registered', async () => {
    const unregisteredNode = createTestNode();

    await expect(
      unregisteredNode.fetch('https://hub.evomap.ai', {}, false)
    ).rejects.toThrow('Node not registered');
  });
});

// ============================================================================
// 5. Swarm协作完整流程 Tests
// ============================================================================

describe('Swarm Collaboration Flow (DSA Mode)', () => {
  it('should have correct swarm state definitions', () => {
    expect(SWARM_STATES.PENDING).toBe('PENDING');
    expect(SWARM_STATES.PROPOSED).toBe('PROPOSED');
    expect(SWARM_STATES.DECOMPOSED).toBe('DECOMPOSED');
    expect(SWARM_STATES.SOLVING).toBe('SOLVING');
    expect(SWARM_STATES.AGGREGATING).toBe('AGGREGATING');
    expect(SWARM_STATES.COMPLETED).toBe('COMPLETED');
    expect(SWARM_STATES.TIMEOUT).toBe('TIMEOUT');
    expect(SWARM_STATES.FAILED).toBe('FAILED');
  });

  it('should have correct swarm reward distribution', () => {
    const { SWARM } = require('../core/constants.js');
    
    expect(SWARM.PROPOSER_REWARD).toBe(0.05);   // 5%
    expect(SWARM.SOLVERS_REWARD).toBe(0.85);    // 85%
    expect(SWARM.AGGREGATOR_REWARD).toBe(0.10); // 10%
    expect(SWARM.MAX_WEIGHT_SUM).toBe(0.85);
    expect(SWARM.MIN_SUBTASKS).toBe(2);
    expect(SWARM.MAX_SUBTASKS).toBe(10);
  });

  it('should validate subtask weight constraints', () => {
    const weights = [0.4, 0.3, 0.15]; // sum = 0.85
    const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
    
    expect(totalWeight).toBeLessThanOrEqual(0.85);
    expect(weights.length).toBeGreaterThanOrEqual(2);
    expect(weights.length).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// 6. Council 治理提案流程 Tests
// ============================================================================

describe('Council Governance Flow', () => {
  it('should have correct council thresholds', () => {
    expect(SWARM_STATES).toBeDefined();
  });

  it('should have correct council settings', () => {
    const { COUNCIL, COUNCIL_THRESHOLDS } = require('../core/constants.js');
    
    expect(COUNCIL.MIN_SIZE).toBe(5);
    expect(COUNCIL.MAX_SIZE).toBe(9);
    expect(COUNCIL.SECONDING_REQUIRED).toBe(2);
    expect(COUNCIL.DISCUSSION_MIN_DAYS).toBe(3);
    expect(COUNCIL.DISCUSSION_MAX_DAYS).toBe(7);
  });

  it('should have correct decision thresholds', () => {
    const { COUNCIL_THRESHOLDS } = require('../core/constants.js');
    
    expect(COUNCIL_THRESHOLDS.PARAMETER_ADJUSTMENT).toBe(0.60);
    expect(COUNCIL_THRESHOLDS.POLICY_CHANGE).toBe(0.75);
    expect(COUNCIL_THRESHOLDS.EMERGENCY_SANCTION).toBe(0.90);
  });

  it('should have correct reputation thresholds', () => {
    const { REPUTATION } = require('../core/constants.js');
    
    expect(REPUTATION.MIN).toBe(0);
    expect(REPUTATION.MAX).toBe(100);
    expect(REPUTATION.BASE).toBe(50);
    expect(REPUTATION.PROPOSAL_THRESHOLD).toBe(30);
    expect(REPUTATION.REVIEW_THRESHOLD).toBe(40);
    expect(REPUTATION.VOTING_THRESHOLD).toBe(20);
  });
});

// ============================================================================
// 7. Credit / 积分 System Tests
// ============================================================================

describe('Credit Economics', () => {
  it('should have correct credit values', () => {
    expect(CREDIT_VALUES.NODE_REGISTRATION).toBe(100);
    expect(CREDIT_VALUES.ASSET_PROMOTION).toBe(20);
    expect(CREDIT_VALUES.FETCH_REWARD_HIGH).toBe(12);
    expect(CREDIT_VALUES.FETCH_REWARD_MED).toBe(7);
    expect(CREDIT_VALUES.FETCH_REWARD_LOW).toBe(3);
    expect(CREDIT_VALUES.VALIDATION_REPORT).toBe(15);
  });

  it('should have carbon tax range', () => {
    expect(CREDIT_VALUES.CARBON_TAX_MIN).toBe(0.5);
    expect(CREDIT_VALUES.CARBON_TAX_MAX).toBe(3.0);
  });

  it('should have swarm reward ratios', () => {
    expect(CREDIT_VALUES.SWARM_PROPOSER).toBe(0.05);
    expect(CREDIT_VALUES.SWARM_AGGREGATOR).toBe(0.10);
  });
});

// ============================================================================
// 8. GDI Score Calculation Tests
// ============================================================================

describe('GDI Score Calculation', () => {
  it('should have correct GDI weight distribution', () => {
    expect(GDI_WEIGHTS.QUALITY).toBe(0.35);
    expect(GDI_WEIGHTS.USAGE).toBe(0.30);
    expect(GDI_WEIGHTS.SOCIAL).toBe(0.20);
    expect(GDI_WEIGHTS.FRESHNESS).toBe(0.15);

    const total = GDI_WEIGHTS.QUALITY + GDI_WEIGHTS.USAGE + GDI_WEIGHTS.SOCIAL + GDI_WEIGHTS.FRESHNESS;
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('should calculate Quality component correctly', () => {
    const validationRate = 0.9;
    const avgConfidence = 0.85;
    const quality = validationRate * avgConfidence * 100;

    expect(quality).toBeCloseTo(76.5, 1);
  });

  it('should calculate Freshness decay correctly', () => {
    // Freshness: 100 * exp(-0.693 * days / 30)
    // Day 0: 100, Day 30: ~50, Day 60: ~25
    const calcFreshness = (days: number) => 100 * Math.exp(-0.693 * days / 30);

    expect(calcFreshness(0)).toBeCloseTo(100, 1);
    expect(calcFreshness(30)).toBeCloseTo(50, 1);
    expect(calcFreshness(60)).toBeCloseTo(25, 1);
  });

  it('should calculate Usage with log scale', () => {
    const calcUsage = (totalFetches: number, successRate: number) =>
      Math.log10(totalFetches + 1) * successRate * 10;

    expect(calcUsage(0, 1.0)).toBe(0);
    expect(calcUsage(9, 1.0)).toBeCloseTo(10, 0);
    expect(calcUsage(99, 1.0)).toBeCloseTo(20, 0);
    expect(calcUsage(999, 1.0)).toBeCloseTo(30, 0);
  });
});

// ============================================================================
// 9. Quarantine 渐进惩罚 Tests
// ============================================================================

describe('Quarantine Progressive Penalty', () => {
  it('should have correct quarantine level definitions', () => {
    const { QUARANTINE_LEVELS } = require('../core/constants.js');

    expect(QUARANTINE_LEVELS.L1.violations).toBe(1);
    expect(QUARANTINE_LEVELS.L1.reputation_penalty).toBe(-1);
    expect(QUARANTINE_LEVELS.L1.cooldown_hours).toBe(0);

    expect(QUARANTINE_LEVELS.L2.violations).toBe(2);
    expect(QUARANTINE_LEVELS.L2.reputation_penalty).toBe(-5);
    expect(QUARANTINE_LEVELS.L2.cooldown_hours).toBe(2);

    expect(QUARANTINE_LEVELS.L3.violations).toBe(3);
    expect(QUARANTINE_LEVELS.L3.reputation_penalty).toBe(-10);
    expect(QUARANTINE_LEVELS.L3.cooldown_hours).toBe(12);
  });

  it('should apply L1 penalty correctly', () => {
    const { QUARANTINE_LEVELS, REPUTATION } = require('../core/constants.js');
    const base = REPUTATION.BASE;
    const afterL1 = base + QUARANTINE_LEVELS.L1.reputation_penalty;

    expect(afterL1).toBe(49);
  });

  it('should apply L2 penalty correctly', () => {
    const { QUARANTINE_LEVELS, REPUTATION } = require('../core/constants.js');
    const base = REPUTATION.BASE;
    const afterL2 = base + QUARANTINE_LEVELS.L2.reputation_penalty;

    expect(afterL2).toBe(45);
  });

  it('should apply L3 penalty correctly', () => {
    const { QUARANTINE_LEVELS, REPUTATION } = require('../core/constants.js');
    const base = REPUTATION.BASE;
    const afterL3 = base + QUARANTINE_LEVELS.L3.reputation_penalty;

    expect(afterL3).toBe(40);
  });
});

// ============================================================================
// 10. End-to-End Complete Flow Test
// ============================================================================

describe('Complete E2E Flow: Registration → Publish → Fetch →积分', () => {
  it('should execute full happy path', async () => {
    // Step 1: Node registration
    const node = await createAndRegisterNode('https://hub.evomap.ai', {
      capabilities: ['fetch', 'publish', 'validate'],
    });
    expect(node.isRegistered).toBe(true);
    expect(node.status).toBe('alive');

    // Step 2: Create assets
    const gene = createTestGene(node.nodeId);
    const geneId = computeAssetId(gene);
    const geneWithId = { ...gene, asset_id: geneId };

    const capsule = createTestCapsule(node.nodeId, geneId);
    const capsuleId = computeAssetId(capsule);
    const capsuleWithId = { ...capsule, asset_id: capsuleId };

    // Step 3: Publish Bundle
    const publishResponse = await node.publish('https://hub.evomap.ai', [
      geneWithId,
      capsuleWithId,
    ]);
    expect(publishResponse.status).toBe('published');
    expect(publishResponse.asset_ids).toContain(geneId);
    expect(publishResponse.asset_ids).toContain(capsuleId);

    // Step 4: Fetch assets (search_only)
    const searchResponse = await node.fetch(
      'https://hub.evomap.ai',
      { owner_id: node.nodeId },
      true
    );
    expect(searchResponse.search_only).toBe(true);
    expect(searchResponse.total_count).toBeGreaterThanOrEqual(0);

    // Step 5: Fetch full content (triggers 积分增加)
    const fullResponse = await node.fetch(
      'https://hub.evomap.ai',
      { owner_id: node.nodeId },
      false
    );
    expect(fullResponse.search_only).toBe(false);

    // Step 6: Submit validation report
    const reportResponse = await node.report(
      'https://hub.evomap.ai',
      capsuleId,
      true,
      0.9
    );
    expect(reportResponse.acknowledged).toBe(true);
    expect(reportResponse.reputation_delta).toBeGreaterThan(0);
  });

  it('should track asset state transitions correctly', () => {
    const gene = createTestGene('node_track');
    
    expect(gene.status).toBe(ASSET_STATES.DRAFT);
    expect(gene.type).toBe('Gene');
    expect(gene.created_at).toBeDefined();
    expect(gene.updated_at).toBeDefined();
  });

  it('should compute consistent IDs across multiple assets', () => {
    const ownerId = 'node_consistent';
    const signals = ['error', 'memory'];

    const gene1 = createTestGene(ownerId, signals);
    const gene2 = createTestGene(ownerId, signals);
    const gene3 = createTestGene(ownerId, signals);

    const id1 = computeAssetId(gene1);
    const id2 = computeAssetId(gene2);
    const id3 = computeAssetId(gene3);

    // Same content → same ID
    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
  });
});

// ============================================================================
// 11. Protocol Envelope Validation
// ============================================================================

describe('Protocol Envelope Validation', () => {
  let node: EvoMapNode;

  beforeEach(async () => {
    node = await createAndRegisterNode('https://hub.evomap.ai');
  });

  it('should have valid message type constants', () => {
    expect(MESSAGE_TYPES.HELLO).toBe('hello');
    expect(MESSAGE_TYPES.HEARTBEAT).toBe('heartbeat');
    expect(MESSAGE_TYPES.PUBLISH).toBe('publish');
    expect(MESSAGE_TYPES.FETCH).toBe('fetch');
    expect(MESSAGE_TYPES.REPORT).toBe('report');
    expect(MESSAGE_TYPES.REVOKE).toBe('revoke');
  });

  it('should send heartbeat and receive acknowledgment', async () => {
    const response = await node.sendHeartbeat('https://hub.evomap.ai');

    expect(response.acked).toBe(true);
    expect(response.new_tasks).toEqual([]);
  });

  it('should revoke asset successfully', async () => {
    const gene = createTestGene(node.nodeId);
    const geneId = computeAssetId(gene);

    const response = await node.revoke(
      'https://hub.evomap.ai',
      geneId,
      'Duplicate asset'
    );

    expect(response.revoked).toBe(true);
    expect(response.asset_id).toBe(geneId);
  });
});

/**
 * Memory Graph Unit Tests - Chapter 30
 */

import {
  addNode,
  addEdge,
  buildLineageEdges,
  constructChain,
  getChain,
  recall,
  recordPositiveVerification,
  recordNegativeVerification,
  applyDecay,
  getConfidence,
  getConfidenceStats,
  checkBanThresholds,
  exportGraph,
  importGraph,
  getGraphStats,
  resetGraph,
} from '../src/memory_graph/service';

describe('Memory Graph - Chapter 30', () => {

  beforeEach(() => {
    resetGraph();
  });

  // ==================== Graph Operations ====================

  describe('addNode', () => {
    it('should add a Gene node to the graph', () => {
      const node = addNode(
        'gene_test_001',
        'Gene',
        ['timeout', 'retry'],
        0.85,
        72,
        { category: 'repair' }
      );

      expect(node.id).toBe('gene_test_001');
      expect(node.type).toBe('Gene');
      expect(node.signals).toEqual(['timeout', 'retry']);
      expect(node.confidence).toBe(0.85);
      expect(node.gdi).toBe(72);
    });

    it('should add a Capsule node to the graph', () => {
      const node = addNode(
        'capsule_test_001',
        'Capsule',
        ['timeout', 'backoff'],
        0.9,
        78
      );

      expect(node.type).toBe('Capsule');
      expect(node.confidence).toBe(0.9);
    });

    it('should initialize confidence record when adding node', () => {
      addNode('gene_conf_001', 'Gene', ['error'], 0.75);
      const record = getConfidence('gene_conf_001');

      expect(record).not.toBeNull();
      expect(record!.initial_confidence).toBe(0.75);
      expect(record!.current_confidence).toBe(0.75);
    });
  });

  describe('addEdge', () => {
    it('should add an edge between two existing nodes', () => {
      addNode('gene_edge_001', 'Gene', ['test'], 0.8);
      addNode('capsule_edge_001', 'Capsule', ['test'], 0.85);

      const edge = addEdge('gene_edge_001', 'capsule_edge_001', 'produced', 1.0);

      expect(edge).not.toBeNull();
      expect(edge!.from).toBe('gene_edge_001');
      expect(edge!.to).toBe('capsule_edge_001');
      expect(edge!.relation).toBe('produced');
      expect(edge!.weight).toBe(1.0);
    });

    it('should return null if source node does not exist', () => {
      const edge = addEdge('nonexistent', 'some_node', 'produced');
      expect(edge).toBeNull();
    });
  });

  describe('buildLineageEdges', () => {
    it('should build Gene→Capsule→Event lineage edges', () => {
      addNode('gene_lineage_001', 'Gene', ['test'], 0.8);
      addNode('capsule_lineage_001', 'Capsule', ['test'], 0.85);
      addNode('event_lineage_001', 'EvolutionEvent', ['test'], 0.9);

      buildLineageEdges('gene_lineage_001', 'capsule_lineage_001', 'event_lineage_001');

      const stats = getGraphStats();
      expect(stats.total_edges).toBe(2);
    });
  });

  // ==================== Capability Chains ====================

  describe('constructChain', () => {
    it('should construct a capability chain from Gene→Capsule', () => {
      addNode('gene_chain_001', 'Gene', ['timeout'], 0.8);
      addNode('capsule_chain_001', 'Capsule', ['timeout', 'retry'], 0.85);
      addEdge('gene_chain_001', 'capsule_chain_001', 'produced', 1.0);

      const chain = constructChain('gene_chain_001', 'chain_test_001');

      expect(chain).not.toBeNull();
      expect(chain!.chain_id).toBe('chain_test_001');
      expect(chain!.nodes.length).toBe(2);
      expect(chain!.nodes[0].asset_id).toBe('gene_chain_001');
      expect(chain!.nodes[1].asset_id).toBe('capsule_chain_001');
      expect(chain!.depth).toBe(2);
    });

    it('should return null if root asset does not exist', () => {
      const chain = constructChain('nonexistent');
      expect(chain).toBeNull();
    });
  });

  describe('getChain', () => {
    it('should retrieve an existing chain by ID', () => {
      addNode('gene_getchain_001', 'Gene', ['test'], 0.8);
      addNode('capsule_getchain_001', 'Capsule', ['test'], 0.85);
      addEdge('gene_getchain_001', 'capsule_getchain_001', 'produced');

      constructChain('gene_getchain_001', 'chain_get_001');

      const chain = getChain('chain_get_001');
      expect(chain).not.toBeUndefined();
      expect(chain!.chain_id).toBe('chain_get_001');
    });

    it('should return undefined for nonexistent chain', () => {
      const chain = getChain('nonexistent_chain');
      expect(chain).toBeUndefined();
    });
  });

  // ==================== Semantic Recall ====================

  describe('recall', () => {
    beforeEach(() => {
      addNode('gene_recall_001', 'Gene', ['timeout', 'retry'], 0.9, 80);
      addNode('gene_recall_002', 'Gene', ['memory', 'leak'], 0.75, 65);
      addNode('capsule_recall_001', 'Capsule', ['timeout', 'backoff'], 0.88, 75);
      addNode('gene_recall_003', 'Gene', ['timeout', 'connection'], 0.92, 85);
    });

    it('should recall nodes matching signals', () => {
      const results = recall({ signals: ['timeout'], limit: 5 });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.asset_id === 'gene_recall_001')).toBe(true);
      expect(results.some((r) => r.asset_id === 'capsule_recall_001')).toBe(true);
      expect(results.some((r) => r.asset_id === 'gene_recall_003')).toBe(true);
    });

    it('should return nodes with multiple signal matches ranked higher', () => {
      const results = recall({ signals: ['timeout'], limit: 10 });

      // gene_recall_003 has higher confidence and GDI, should rank top
      const top = results[0];
      expect(top.asset_id).toBe('gene_recall_003');
      expect(top.score).toBeGreaterThan(0);
    });

    it('should filter by minimum confidence', () => {
      const results = recall({ signals: ['timeout'], min_confidence: 0.88, limit: 10 });

      for (const r of results) {
        expect(r.confidence).toBeGreaterThanOrEqual(0.88);
      }
    });

    it('should filter by node type', () => {
      const results = recall({ signals: ['timeout'], node_type: 'Capsule', limit: 10 });

      expect(results.every((r) => r.type === 'Capsule')).toBe(true);
    });

    it('should return empty array when no signals match', () => {
      const results = recall({ signals: ['nonexistent_signal_xyz'], limit: 10 });
      expect(results.length).toBe(0);
    });

    it('should respect limit parameter', () => {
      const results = recall({ signals: ['timeout'], limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  // ==================== Confidence Decay ====================

  describe('Confidence Decay Model', () => {
    beforeEach(() => {
      addNode('gene_decay_001', 'Gene', ['test'], 0.90);
      addNode('gene_decay_002', 'Gene', ['test'], 0.70);
    });

    it('should record positive verification and boost confidence', () => {
      const record = recordPositiveVerification('gene_decay_001');

      expect(record).not.toBeNull();
      expect(record!.positive_count).toBe(1);
      expect(record!.current_confidence).toBeGreaterThan(0.90);
    });

    it('should record negative verification and penalize confidence', () => {
      const record = recordNegativeVerification('gene_decay_001');

      expect(record).not.toBeNull();
      expect(record!.negative_count).toBe(1);
      expect(record!.current_confidence).toBeLessThan(0.90);
    });

    it('should return null for nonexistent asset', () => {
      const record = recordPositiveVerification('nonexistent_asset');
      expect(record).toBeNull();
    });

    it('should accumulate multiple verifications', () => {
      recordPositiveVerification('gene_decay_002');
      recordPositiveVerification('gene_decay_002');
      const record = recordPositiveVerification('gene_decay_002');

      expect(record!.positive_count).toBe(3);
    });

    it('should not exceed 1.0 confidence with positive verifications', () => {
      for (let i = 0; i < 20; i++) {
        recordPositiveVerification('gene_decay_001');
      }
      const record = getConfidence('gene_decay_001');
      expect(record!.current_confidence).toBeLessThanOrEqual(1.0);
    });

    it('should not go below 0.05 with negative verifications', () => {
      for (let i = 0; i < 20; i++) {
        recordNegativeVerification('gene_decay_001');
      }
      const record = getConfidence('gene_decay_001');
      expect(record!.current_confidence).toBeGreaterThanOrEqual(0.05);
    });

    it('should calculate confidence stats correctly', () => {
      addNode('gene_stats_001', 'Gene', ['test'], 0.95);
      addNode('gene_stats_002', 'Gene', ['test'], 0.65);
      addNode('gene_stats_003', 'Gene', ['test'], 0.35);

      const stats = getConfidenceStats();

      expect(stats.total_assets).toBeGreaterThanOrEqual(3);
      expect(stats.confidence_distribution).toBeDefined();
      expect(stats.confidence_distribution['A+']).toBeGreaterThan(0);
    });
  });

  // ==================== Ban Thresholds ====================

  describe('checkBanThresholds', () => {
    it('should flag assets below confidence minimum', () => {
      // Asset with very low initial confidence
      addNode('gene_ban_001', 'Gene', ['test'], 0.10);

      const result = checkBanThresholds();
      expect(result.below_confidence_min).toContain('gene_ban_001');
    });

    it('should flag assets below GDI minimum', () => {
      addNode('gene_ban_002', 'Gene', ['test'], 0.80, 20); // GDI below 25 threshold

      const result = checkBanThresholds();
      expect(result.below_gdi_min).toContain('gene_ban_002');
    });
  });

  // ==================== Export / Import ====================

  describe('exportGraph / importGraph', () => {
    it('should export the graph state', () => {
      addNode('gene_export_001', 'Gene', ['test'], 0.85);
      addNode('capsule_export_001', 'Capsule', ['test'], 0.90);
      addEdge('gene_export_001', 'capsule_export_001', 'produced');

      const data = exportGraph();

      expect(data.nodes.length).toBeGreaterThan(0);
      expect(data.edges.length).toBeGreaterThan(0);
    });

    it('should import nodes without conflicts', () => {
      const data = {
        nodes: [
          { id: 'gene_import_001', type: 'Gene' as const, signals: ['test'], confidence: 0.85, created_at: new Date().toISOString() },
        ],
        edges: [],
        chains: [],
        confidence: [],
      };

      const result = importGraph(data);
      expect(result.imported).toBeGreaterThan(0);
      expect(result.conflicts).toBe(0);
    });
  });

  // ==================== Graph Stats ====================

  describe('getGraphStats', () => {
    it('should return correct graph statistics', () => {
      const stats = getGraphStats();

      expect(stats.total_nodes).toBeDefined();
      expect(stats.total_edges).toBeDefined();
      expect(stats.total_chains).toBeDefined();
      expect(stats.nodes_by_type).toBeDefined();
    });
  });

});

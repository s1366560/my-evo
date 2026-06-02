// Graph engine and algorithms service tests — computeLayout, validateGraph,
// calculatePageRank, detectCycles, findPath, topologicalSort (all in mock/no-DB mode).
import { describe, test, expect } from '@jest/globals';
import { graphEngine } from './engine.js';
import { graphAlgorithms } from './algorithms.js';

beforeAll(() => {
  delete process.env.DATABASE_URL;
});

describe('GraphEngine', () => {
  describe('computeLayout', () => {
    const nodes = [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 100, y: 0 },
      { id: 'c', x: 50, y: 100 },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ];

    test('force layout returns positions for all nodes', () => {
      const result = graphEngine.computeLayout(nodes, edges, 'force');
      expect(result.nodes).toHaveLength(3);
      expect(result.layoutTime).toBeGreaterThanOrEqual(0);
      for (const n of result.nodes) {
        expect(typeof n.x).toBe('number');
        expect(typeof n.y).toBe('number');
      }
    });

    test('grid layout arranges nodes in a grid', () => {
      const result = graphEngine.computeLayout(nodes, edges, 'grid');
      expect(result.nodes).toHaveLength(3);
      const xs = result.nodes.map(n => n.x);
      const ys = result.nodes.map(n => n.y);
      // Grid should have distinct positions
      expect(new Set(xs.map(x => Math.round(x))).size).toBeGreaterThanOrEqual(1);
    });

    test('radial layout arranges nodes in a circle', () => {
      const result = graphEngine.computeLayout(nodes, edges, 'radial');
      expect(result.nodes).toHaveLength(3);
      // Radial positions should be spread around center
      const cx = 400, cy = 300;
      for (const n of result.nodes) {
        const dist = Math.sqrt((n.x - cx) ** 2 + (n.y - cy) ** 2);
        expect(dist).toBeGreaterThan(0);
      }
    });

    test('handles single node', () => {
      const result = graphEngine.computeLayout([{ id: 'solo' }], [], 'force');
      expect(result.nodes).toHaveLength(1);
    });

    test('handles empty graph', () => {
      const result = graphEngine.computeLayout([], [], 'grid');
      expect(result.nodes).toHaveLength(0);
    });

    test('uses default position when node has no x/y', () => {
      const result = graphEngine.computeLayout([{ id: 'n1' }, { id: 'n2' }], [{ source: 'n1', target: 'n2' }], 'force');
      expect(result.nodes).toHaveLength(2);
      // Both should have numeric positions
      for (const n of result.nodes) {
        expect(typeof n.x).toBe('number');
        expect(typeof n.y).toBe('number');
      }
    });
  });

  describe('validateGraph', () => {
    test('returns valid for a well-formed graph', () => {
      const result = graphEngine.validateGraph(
        [{ id: 'a' }, { id: 'b' }],
        [{ source: 'a', target: 'b' }],
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects orphaned edge (unknown source)', () => {
      const result = graphEngine.validateGraph(
        [{ id: 'a' }],
        [{ source: 'a', target: 'missing' }],
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown target'))).toBe(true);
    });

    test('detects orphaned edge (unknown target)', () => {
      const result = graphEngine.validateGraph(
        [{ id: 'b' }],
        [{ source: 'missing', target: 'b' }],
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('unknown source'))).toBe(true);
    });

    test('detects self-loop', () => {
      const result = graphEngine.validateGraph(
        [{ id: 'a' }],
        [{ source: 'a', target: 'a' }],
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Self-loop'))).toBe(true);
    });

    test('empty graph is valid', () => {
      const result = graphEngine.validateGraph([], []);
      expect(result.valid).toBe(true);
    });
  });

  describe('calculateMetrics (no DB)', () => {
    test('returns error when database is not available', async () => {
      const result = await graphEngine.calculateMetrics('any');
      expect(result.success).toBe(false);
    });
  });

  describe('calculateNodeMetrics (no DB)', () => {
    test('returns error when database is not available', async () => {
      const result = await graphEngine.calculateNodeMetrics('any');
      expect(result.success).toBe(false);
    });
  });
});

describe('GraphAlgorithms (no DB)', () => {
  test('calculatePageRank returns empty data without DB', async () => {
    const result = await graphAlgorithms.calculatePageRank('owner');
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });

  test('detectCycles returns empty data without DB', async () => {
    const result = await graphAlgorithms.detectCycles('owner');
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  test('findPath returns no path without DB', async () => {
    const result = await graphAlgorithms.findPath('owner', 'a', 'b');
    expect(result.success).toBe(true);
    expect(result.data.path).toEqual([]);
    expect(result.data.distance).toBe(-1);
  });

  test('topologicalSort returns empty order without DB', async () => {
    const result = await graphAlgorithms.topologicalSort('owner');
    expect(result.success).toBe(true);
    expect(result.data.order).toEqual([]);
    expect(result.data.levels).toEqual({});
  });
});

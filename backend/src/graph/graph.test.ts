// Graph Engine Unit Tests
import { describe, test, expect } from '@jest/globals';
import { GraphEngine } from './engine.js';
import { GraphAlgorithms } from './algorithms.js';

describe('GraphEngine', () => {
  let engine: GraphEngine;

  beforeEach(() => {
    engine = new GraphEngine();
  });

  describe('computeLayout', () => {
    test('should compute grid layout', () => {
      const nodes = [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 0, y: 0 },
        { id: 'n3', x: 0, y: 0 },
      ];
      const edges: Array<{ source: string; target: string }> = [];

      const result = engine.computeLayout(nodes, edges, 'grid');

      expect(result.nodes).toHaveLength(3);
      // Grid layout should arrange nodes in a grid pattern
      result.nodes.forEach((n, i) => {
        expect(n).toHaveProperty('x');
        expect(n).toHaveProperty('y');
      });
    });

    test('should compute radial layout', () => {
      const nodes = [
        { id: 'n1' },
        { id: 'n2' },
        { id: 'n3' },
        { id: 'n4' },
      ];
      const edges: Array<{ source: string; target: string }> = [];

      const result = engine.computeLayout(nodes, edges, 'radial');

      expect(result.nodes).toHaveLength(4);
      // All nodes should be on a circle (same distance from center)
      const centerX = 400, centerY = 300;
      const distances = result.nodes.map(n => 
        Math.sqrt(Math.pow((n as { x: number }).x - centerX, 2) + Math.pow((n as { y: number }).y - centerY, 2))
      );
      // Radial layout should place nodes at equal angles
      expect(distances[0]).toBeCloseTo(distances[1], 0);
    });

    test('should compute force-directed layout', () => {
      const nodes = [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 100, y: 100 },
        { id: 'n3', x: 200, y: 200 },
      ];
      const edges = [
        { source: 'n1', target: 'n2' },
        { source: 'n2', target: 'n3' },
      ];

      const result = engine.computeLayout(nodes, edges, 'force');

      expect(result.nodes).toHaveLength(3);
      result.nodes.forEach(n => {
        expect(n).toHaveProperty('x');
        expect(n).toHaveProperty('y');
      });
    });

    test('should handle empty nodes array', () => {
      const nodes: Array<{ id: string }> = [];
      const edges: Array<{ source: string; target: string }> = [];

      const result = engine.computeLayout(nodes, edges, 'grid');

      expect(result.nodes).toHaveLength(0);
    });

    test('should handle single node', () => {
      const nodes = [{ id: 'n1' }];
      const edges: Array<{ source: string; target: string }> = [];

      const result = engine.computeLayout(nodes, edges, 'grid');

      expect(result.nodes).toHaveLength(1);
    });
  });

  describe('validateGraph', () => {
    test('should validate valid graph', () => {
      const nodes = [
        { id: 'n1' },
        { id: 'n2' },
        { id: 'n3' },
      ];
      const edges = [
        { source: 'n1', target: 'n2' },
        { source: 'n2', target: 'n3' },
      ];

      const result = engine.validateGraph(nodes, edges);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect orphaned edges', () => {
      const nodes = [{ id: 'n1' }];
      const edges = [
        { source: 'n1', target: 'n2' }, // n2 doesn't exist
      ];

      const result = engine.validateGraph(nodes, edges);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('n2');
    });

    test('should detect self-loops', () => {
      const nodes = [{ id: 'n1' }, { id: 'n2' }];
      const edges = [
        { source: 'n1', target: 'n1' }, // self-loop
        { source: 'n1', target: 'n2' },
      ];

      const result = engine.validateGraph(nodes, edges);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Self-loop'))).toBe(true);
    });

    test('should handle empty graph', () => {
      const nodes: Array<{ id: string }> = [];
      const edges: Array<{ source: string; target: string }> = [];

      const result = engine.validateGraph(nodes, edges);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle disconnected nodes', () => {
      const nodes = [{ id: 'n1' }, { id: 'n2' }];
      const edges: Array<{ source: string; target: string }> = [];

      const result = engine.validateGraph(nodes, edges);

      expect(result.valid).toBe(true);
    });
  });

  describe('calculateMetrics', () => {
    test('should return error when database not available', async () => {
      const result = await engine.calculateMetrics('any-node-id');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('calculateNodeMetrics', () => {
    test('should return error when database not available', async () => {
      const result = await engine.calculateNodeMetrics('any-node-id');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('GraphAlgorithms', () => {
  let algorithms: GraphAlgorithms;

  beforeEach(() => {
    algorithms = new GraphAlgorithms();
  });

  describe('calculatePageRank', () => {
    test('should return empty result when database not available', async () => {
      const result = await algorithms.calculatePageRank('any-owner-id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });
  });

  describe('detectCycles', () => {
    test('should return empty cycles when database not available', async () => {
      const result = await algorithms.detectCycles('any-owner-id');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('findPath', () => {
    test('should return no path when database not available', async () => {
      const result = await algorithms.findPath('any-owner-id', 'source', 'target');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (!result.data) {
        throw new Error('Expected findPath to return path data');
      }
      expect(result.data.path).toEqual([]);
      expect(result.data.distance).toBe(-1);
    });
  });

  describe('topologicalSort', () => {
    test('should return empty result when database not available', async () => {
      const result = await algorithms.topologicalSort('any-owner-id');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (!result.data) {
        throw new Error('Expected topologicalSort to return order data');
      }
      expect(result.data.order).toEqual([]);
    });
  });
});

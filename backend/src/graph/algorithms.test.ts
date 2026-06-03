// Graph engine + algorithms — exercises the DB-backed branches by injecting a
// fake Prisma client via the exported `prisma` variable.
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { graphEngine } from './engine.js';
import { graphAlgorithms } from './algorithms.js';

// Mock the db module so getPrisma() returns our fake.
let fakeDb: any = null;
jest.mock('../db/index.js', () => {
  const actual = jest.requireActual('../db/index.js') as any;
  return {
    ...actual,
    prisma: null,
    getPrisma: () => fakeDb,
    isMockMode: () => fakeDb === null,
  };
});

interface FakeEdge { id: string; sourceId: string; targetId: string; ownerId: string; }
interface FakeNode { id: string; ownerId: string; }

function makeFakePrisma(nodes: FakeNode[], edges: FakeEdge[]) {
  return {
    node: {
      findMany: async (args: any) => {
        const ownerId = args?.where?.ownerId;
        if (ownerId) return nodes.filter(n => n.ownerId === ownerId).map(n => ({ id: n.id, ownerId: n.ownerId }));
        return nodes;
      },
      findUnique: async (args: any) => {
        const id = args?.where?.id;
        const n = nodes.find(x => x.id === id);
        if (!n) return null;
        return n;
      },
    },
    edge: {
      findMany: async (args: any) => {
        const ownerId = args?.where?.sourceNode?.ownerId;
        if (ownerId) return edges.filter(e => e.ownerId === ownerId);
        return edges;
      },
      count: async (args: any) => {
        const src = args?.where?.sourceId;
        const tgt = args?.where?.targetId;
        if (src) return edges.filter(e => e.sourceId === src).length;
        if (tgt) return edges.filter(e => e.targetId === tgt).length;
        return edges.length;
      },
    },
  } as any;
}

describe('GraphAlgorithms with fake Prisma', () => {
  test('calculatePageRank returns ranks for the owner', async () => {
    fakeDb = makeFakePrisma(
      [{ id: 'a', ownerId: 'o' }, { id: 'b', ownerId: 'o' }, { id: 'c', ownerId: 'o' }],
      [{ id: 'e1', sourceId: 'a', targetId: 'b', ownerId: 'o' }, { id: 'e2', sourceId: 'b', targetId: 'c', ownerId: 'o' }]
    );
    const r = await graphAlgorithms.calculatePageRank('o');
    expect(r.success).toBe(true);
    expect(Object.keys(r.data).sort()).toEqual(['a', 'b', 'c']);
    const sum = Object.values(r.data as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1);
  });

  test('calculatePageRank returns empty when no nodes', async () => {
    fakeDb = makeFakePrisma([], []);
    const r = await graphAlgorithms.calculatePageRank('o');
    expect(r.success).toBe(true);
    expect(r.data).toEqual({});
  });

  test('detectCycles returns empty for a DAG', async () => {
    fakeDb = makeFakePrisma(
      [{ id: 'a', ownerId: 'o' }, { id: 'b', ownerId: 'o' }],
      [{ id: 'e1', sourceId: 'a', targetId: 'b', ownerId: 'o' }]
    );
    const r = await graphAlgorithms.detectCycles('o');
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  test('detectCycles finds a cycle', async () => {
    fakeDb = makeFakePrisma(
      [{ id: 'a', ownerId: 'o' }, { id: 'b', ownerId: 'o' }],
      [
        { id: 'e1', sourceId: 'a', targetId: 'b', ownerId: 'o' },
        { id: 'e2', sourceId: 'b', targetId: 'a', ownerId: 'o' },
      ]
    );
    const r = await graphAlgorithms.detectCycles('o');
    expect(r.success).toBe(true);
    expect(r.data.length).toBeGreaterThan(0);
  });

  test('detectCycles returns empty when no edges', async () => {
    fakeDb = makeFakePrisma([{ id: 'a', ownerId: 'o' }], []);
    const r = await graphAlgorithms.detectCycles('o');
    expect(r.success).toBe(true);
    expect(r.data).toEqual([]);
  });

  test('findPath finds a path between two nodes', async () => {
    fakeDb = makeFakePrisma(
      [{ id: 'a', ownerId: 'o' }, { id: 'b', ownerId: 'o' }, { id: 'c', ownerId: 'o' }],
      [
        { id: 'e1', sourceId: 'a', targetId: 'b', ownerId: 'o' },
        { id: 'e2', sourceId: 'b', targetId: 'c', ownerId: 'o' },
      ]
    );
    const r = await graphAlgorithms.findPath('o', 'a', 'c');
    expect(r.success).toBe(true);
    expect(r.data.path).toEqual(['a', 'b', 'c']);
    expect(r.data.distance).toBe(2);
  });

  test('findPath returns no path when disconnected', async () => {
    fakeDb = makeFakePrisma(
      [{ id: 'a', ownerId: 'o' }, { id: 'b', ownerId: 'o' }],
      []
    );
    const r = await graphAlgorithms.findPath('o', 'a', 'b');
    expect(r.success).toBe(true);
    expect(r.data.path).toEqual([]);
    expect(r.data.distance).toBe(-1);
  });

  test('findPath returns the same node if source === target', async () => {
    fakeDb = makeFakePrisma([{ id: 'a', ownerId: 'o' }], []);
    const r = await graphAlgorithms.findPath('o', 'a', 'a');
    expect(r.success).toBe(true);
    expect(r.data.path).toEqual(['a']);
    expect(r.data.distance).toBe(0);
  });

  test('topologicalSort returns a valid order for a DAG', async () => {
    fakeDb = makeFakePrisma(
      [{ id: 'a', ownerId: 'o' }, { id: 'b', ownerId: 'o' }, { id: 'c', ownerId: 'o' }],
      [
        { id: 'e1', sourceId: 'a', targetId: 'b', ownerId: 'o' },
        { id: 'e2', sourceId: 'a', targetId: 'c', ownerId: 'o' },
        { id: 'e3', sourceId: 'b', targetId: 'c', ownerId: 'o' },
      ]
    );
    const r = await graphAlgorithms.topologicalSort('o');
    expect(r.success).toBe(true);
    expect(r.data.order).toEqual(['a', 'b', 'c']);
    expect(r.data.levels).toEqual({ b: 1, c: 2 });
  });

  test('topologicalSort returns empty for empty graph', async () => {
    fakeDb = makeFakePrisma([], []);
    const r = await graphAlgorithms.topologicalSort('o');
    expect(r.success).toBe(true);
    expect(r.data.order).toEqual([]);
  });
});

describe('GraphEngine with fake Prisma', () => {
  test('calculateMetrics returns error for unknown node', async () => {
    fakeDb = makeFakePrisma([], []);
    const r = await graphEngine.calculateMetrics('unknown');
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
  });

  test('calculateMetrics returns metrics for a node', async () => {
    fakeDb = {
      node: {
        findUnique: async (args: any) => {
          if (args.where.id === 'root') return { id: 'root', ownerId: 'o' };
          return null;
        },
      },
      edge: {
        findMany: async (args: any) => {
          if (args.where?.OR) {
            return [
              { sourceId: 'root', targetId: 'n1' },
              { sourceId: 'n1', targetId: 'n2' },
            ];
          }
          return [];
        },
        count: async () => 2,
      },
    };
    const r = await graphEngine.calculateMetrics('root');
    expect(r.success).toBe(true);
    expect(r.data.nodeCount).toBeGreaterThan(0);
  });

  test('calculateNodeMetrics returns error for unknown node', async () => {
    fakeDb = makeFakePrisma([], []);
    const r = await graphEngine.calculateNodeMetrics('unknown');
    expect(r.success).toBe(false);
  });

  test('calculateNodeMetrics returns in/out degree', async () => {
    fakeDb = {
      node: {
        findUnique: async (args: any) => args.where.id === 'n' ? { id: 'n' } : null,
      },
      edge: {
        count: async (args?: any) => {
          if (args?.where?.sourceId) return 3;
          if (args?.where?.targetId) return 2;
          return 5;
        },
      },
    };
    const r = await graphEngine.calculateNodeMetrics('n');
    expect(r.success).toBe(true);
    expect(r.data.inDegree).toBe(2);
    expect(r.data.outDegree).toBe(3);
  });
});

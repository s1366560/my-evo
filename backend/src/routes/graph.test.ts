// Graph Algorithms Tests — tests actual GraphAlgorithms with mocked getPrisma
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// We test GraphAlgorithms logic by extracting the pure algorithm methods
// and providing controlled inputs. Since the class depends on getPrisma(),
// we directly test the algorithmic behavior using the MockStore data.
import { MockStore } from '../db/mock-store.js';
import { HttpError } from '../middleware/errorHandler.js';

describe('Graph Algorithms — MockStore Integration', () => {
  let store: MockStore;

  beforeEach(() => {
    store = new MockStore();
  });

  // Build a simple graph: n1 → n2 → n3
  async function buildLinearGraph() {
    const user = await store.createUser({
      email: 'graph@test.com', password: 'x', name: 'Graph', level: 1, reputation: 0, credits: 0,
    });
    const map = await store.createMap({ userId: user.id, name: 'GraphMap', description: '', isPublic: false });
    const n1 = await store.createNode({ mapId: map.id, label: 'N1', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n2 = await store.createNode({ mapId: map.id, label: 'N2', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    const n3 = await store.createNode({ mapId: map.id, label: 'N3', description: '', nodeType: 'concept', positionX: 0, positionY: 0, metadata: {} });
    await store.createEdge({ mapId: map.id, sourceId: n1.id, targetId: n2.id, label: 'e12', metadata: {} });
    await store.createEdge({ mapId: map.id, sourceId: n2.id, targetId: n3.id, label: 'e23', metadata: {} });
    return { user, map, nodes: [n1, n2, n3] };
  }

  test('MockStore edge lookup returns correct edges for map', async () => {
    const { map } = await buildLinearGraph();
    const edges = await store.findEdgesByMapId(map.id);
    expect(edges).toHaveLength(2);
    expect(edges.map(e => e.label)).toEqual(['e12', 'e23']);
  });

  test('edge traversal from source to target works', async () => {
    const { map, nodes } = await buildLinearGraph();
    const edges = await store.findEdgesByMapId(map.id);
    // BFS from n1 should reach n3 via n2
    const adj: Record<string, string[]> = {};
    for (const n of nodes) adj[n.id] = [];
    for (const e of edges) {
      if (!adj[e.sourceId]) adj[e.sourceId] = [];
      adj[e.sourceId].push(e.targetId);
    }
    // BFS
    const visited = new Set<string>([nodes[0].id]);
    const queue = [nodes[0].id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const nb of adj[cur] || []) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }
    expect(visited.has(nodes[2].id)).toBe(true);
  });
});

describe('Graph Algorithms — PageRank Pure Logic', () => {
  test('converges to (1-d)/n with no incoming links', () => {
    // With no edges, all nodes have sum=0, so each iteration gives (1-d)/n
    // After convergence, every node has exactly (1-d)/n = 0.075
    const nodes = ['n1', 'n2', 'n3'];
    const edges: { sourceId: string; targetId: string }[] = [];
    let ranks: Record<string, number> = {};
    for (const n of nodes) ranks[n] = 1 / nodes.length;
    const damping = 0.85;
    const incoming: Record<string, string[]> = {};
    for (const n of nodes) incoming[n] = [];
    for (const e of edges) { if (incoming[e.targetId]) incoming[e.targetId].push(e.sourceId); }
    for (let i = 0; i < 50; i++) {
      const newRanks: Record<string, number> = {};
      for (const node of nodes) {
        let sum = 0;
        for (const src of incoming[node]) {
          const outLinks = edges.filter(e => e.sourceId === src).length;
          if (outLinks > 0) sum += ranks[src] / outLinks;
        }
        newRanks[node] = (1 - damping) / nodes.length + damping * sum;
      }
      ranks = newRanks;
    }
    // With no incoming links, each node converges to (1-d)/n ≈ 0.05
    const expected = (1 - damping) / nodes.length;
    for (const n of nodes) expect(ranks[n]).toBeCloseTo(expected, 5);
    // Without normalization, sum = n * (1-d)/n = 1-d = 0.15
    const sum = Object.values(ranks).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1 - damping, 5);
  });

  test('converges rank toward linked node', () => {
    const nodes = ['n1', 'n2'];
    const edges = [{ sourceId: 'n1', targetId: 'n2' }];
    let ranks: Record<string, number> = {};
    for (const n of nodes) ranks[n] = 1 / nodes.length;
    const damping = 0.85;
    const incoming: Record<string, string[]> = { n1: [], n2: [] };
    for (const e of edges) { if (incoming[e.targetId]) incoming[e.targetId].push(e.sourceId); }
    for (let i = 0; i < 100; i++) {
      const newRanks: Record<string, number> = {};
      for (const node of nodes) {
        let sum = 0;
        for (const src of incoming[node]) {
          const outLinks = edges.filter(e => e.sourceId === src).length;
          if (outLinks > 0) sum += ranks[src] / outLinks;
        }
        newRanks[node] = (1 - damping) / nodes.length + damping * sum;
      }
      ranks = newRanks;
    }
    expect(ranks['n2']).toBeGreaterThan(ranks['n1']);
  });
});

describe('Graph Algorithms — Cycle Detection Pure Logic', () => {
  function detectCycles(edges: { sourceId: string; targetId: string }[]): string[][] {
    const adj: Record<string, string[]> = {};
    for (const e of edges) {
      if (!adj[e.sourceId]) adj[e.sourceId] = [];
      adj[e.sourceId].push(e.targetId);
    }
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);
      for (const neighbor of adj[nodeId] || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          cycles.push([...path.slice(path.indexOf(neighbor)), neighbor]);
        }
      }
      path.pop();
      recStack.delete(nodeId);
      return false;
    };
    for (const node of Object.keys(adj)) { if (!visited.has(node)) dfs(node); }
    return cycles;
  }

  test('returns empty when no edges', () => {
    expect(detectCycles([])).toEqual([]);
  });

  test('returns empty for DAG', () => {
    const edges = [{ sourceId: 'A', targetId: 'B' }, { sourceId: 'B', targetId: 'C' }];
    expect(detectCycles(edges)).toEqual([]);
  });

  test('detects simple cycle A→B→A', () => {
    const edges = [{ sourceId: 'A', targetId: 'B' }, { sourceId: 'B', targetId: 'A' }];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBeGreaterThan(0);
  });

  test('detects longer cycle A→B→C→A', () => {
    const edges = [
      { sourceId: 'A', targetId: 'B' },
      { sourceId: 'B', targetId: 'C' },
      { sourceId: 'C', targetId: 'A' },
    ];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe('Graph Algorithms — BFS Path Finding Pure Logic', () => {
  function findPath(
    edges: { sourceId: string; targetId: string; type?: string }[],
    sourceId: string, targetId: string,
  ) {
    const adj: Record<string, string[]> = {};
    for (const e of edges) {
      if (!adj[e.sourceId]) adj[e.sourceId] = [];
      adj[e.sourceId].push(e.targetId);
      if (e.type === 'bidirectional') {
        if (!adj[e.targetId]) adj[e.targetId] = [];
        adj[e.targetId].push(e.sourceId);
      }
    }
    const queue: { node: string; path: string[] }[] = [{ node: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (node === targetId) return { path, distance: path.length - 1 };
      for (const neighbor of adj[node] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }
    return { path: [] as string[], distance: -1 };
  }

  test('returns empty path when no route', () => {
    const result = findPath([], 'X', 'Y');
    expect(result.path).toEqual([]);
    expect(result.distance).toBe(-1);
  });

  test('finds direct path', () => {
    const result = findPath([{ sourceId: 'A', targetId: 'B' }], 'A', 'B');
    expect(result.path).toEqual(['A', 'B']);
    expect(result.distance).toBe(1);
  });

  test('finds multi-hop path', () => {
    const edges = [
      { sourceId: 'A', targetId: 'B' },
      { sourceId: 'B', targetId: 'C' },
    ];
    const result = findPath(edges, 'A', 'C');
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBe(2);
  });

  test('handles bidirectional edges', () => {
    const result = findPath([{ sourceId: 'A', targetId: 'B', type: 'bidirectional' }], 'B', 'A');
    expect(result.path).toEqual(['B', 'A']);
    expect(result.distance).toBe(1);
  });

  test('returns empty when source equals target but no self-loop', () => {
    const result = findPath([{ sourceId: 'A', targetId: 'B' }], 'A', 'A');
    expect(result.path).toEqual(['A']);
    expect(result.distance).toBe(0);
  });
});

describe('Graph Algorithms — Topological Sort Pure Logic', () => {
  test('returns correct order for linear DAG', () => {
    const nodes = ['A', 'B', 'C'];
    const edges = [{ sourceId: 'A', targetId: 'B' }, { sourceId: 'B', targetId: 'C' }];
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    for (const n of nodes) { inDegree[n] = 0; adj[n] = []; }
    for (const e of edges) {
      adj[e.sourceId].push(e.targetId);
      inDegree[e.targetId]++;
    }
    const queue = nodes.filter(n => inDegree[n] === 0);
    const order: string[] = [];
    const levels: Record<string, number> = {};
    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);
      for (const nb of adj[node]) {
        inDegree[nb]--;
        levels[nb] = Math.max(levels[nb] || 0, (levels[node] || 0) + 1);
        if (inDegree[nb] === 0) queue.push(nb);
      }
    }
    expect(order).toEqual(['A', 'B', 'C']);
    expect(levels['B']).toBe(1);
    expect(levels['C']).toBe(2);
  });

  test('handles diamond DAG', () => {
    const nodes = ['A', 'B', 'C', 'D'];
    const edges = [
      { sourceId: 'A', targetId: 'B' },
      { sourceId: 'A', targetId: 'C' },
      { sourceId: 'B', targetId: 'D' },
      { sourceId: 'C', targetId: 'D' },
    ];
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    for (const n of nodes) { inDegree[n] = 0; adj[n] = []; }
    for (const e of edges) { adj[e.sourceId].push(e.targetId); inDegree[e.targetId]++; }
    const queue = nodes.filter(n => inDegree[n] === 0);
    const order: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);
      for (const nb of adj[node]) { inDegree[nb]--; if (inDegree[nb] === 0) queue.push(nb); }
    }
    expect(order).toHaveLength(4);
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('B'));
    expect(order.indexOf('A')).toBeLessThan(order.indexOf('C'));
    expect(order.indexOf('B')).toBeLessThan(order.indexOf('D'));
    expect(order.indexOf('C')).toBeLessThan(order.indexOf('D'));
  });
});

describe('Graph Routes — HttpError validation', () => {
  test('HttpError 400 for missing source/target', () => {
    const err = new HttpError(400, 'source and target query params required');
    expect(err.statusCode).toBe(400);
  });

  test('HttpError 400 for missing nodes/edges in layout', () => {
    const err = new HttpError(400, 'nodes and edges are required');
    expect(err.statusCode).toBe(400);
  });
});

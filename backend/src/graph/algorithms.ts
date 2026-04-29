// Graph Computation Engine - Algorithms
import { getPrisma } from '../db/index.js';

export class GraphAlgorithms {
  async calculatePageRank(ownerId: string, damping = 0.85, iterations = 100) {
    const db = getPrisma();
    if (!db) return { success: true, data: {} };
    const nodes = await db.node.findMany({ where: { ownerId }, select: { id: true } });
    if (nodes.length === 0) return { success: true, data: {} };

    const edges = await db.edge.findMany({ where: { sourceNode: { ownerId } } });

    let ranks: Record<string, number> = {};
    for (const n of nodes) ranks[n.id] = 1 / nodes.length;

    const incoming: Record<string, string[]> = {};
    for (const n of nodes) incoming[n.id] = [];
    for (const e of edges) {
      if (incoming[e.targetId]) incoming[e.targetId].push(e.sourceId);
    }

    for (let i = 0; i < iterations; i++) {
      const newRanks: Record<string, number> = {};
      for (const node of nodes) {
        let sum = 0;
        for (const src of incoming[node.id] || []) {
          const outLinks = edges.filter((e: { sourceId: string }) => e.sourceId === src).length;
          if (outLinks > 0) sum += ranks[src] / outLinks;
        }
        newRanks[node.id] = (1 - damping) / nodes.length + damping * sum;
      }
      ranks = newRanks;
    }
    return { success: true, data: ranks };
  }

  async detectCycles(ownerId: string) {
    const db = getPrisma();
    if (!db) return { success: true, data: [] };
    const edges = await db.edge.findMany({ where: { sourceNode: { ownerId } } });
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
    return { success: true, data: cycles };
  }

  async findPath(ownerId: string, sourceId: string, targetId: string) {
    const db = getPrisma();
    if (!db) return { success: true, data: { path: [], distance: -1 } };
    const edges = await db.edge.findMany({ where: { sourceNode: { ownerId } } });
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
      if (node === targetId) return { success: true, data: { path, distance: path.length - 1 } };
      for (const neighbor of adj[node] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ node: neighbor, path: [...path, neighbor] });
        }
      }
    }
    return { success: true, data: { path: [], distance: -1 } };
  }

  async topologicalSort(ownerId: string) {
    const db = getPrisma();
    if (!db) return { success: true, data: { order: [], levels: {} } };
    const result = await this.detectCycles(ownerId);
    if (result.data && result.data.length > 0) {
      return { success: false, error: 'Graph contains cycles' };
    }
    const edges = await db.edge.findMany({ where: { sourceNode: { ownerId } } });
    const nodes = await db.node.findMany({ where: { ownerId }, select: { id: true } });
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    for (const n of nodes) { inDegree[n.id] = 0; adj[n.id] = []; }
    for (const e of edges) {
      adj[e.sourceId]?.push(e.targetId);
      inDegree[e.targetId] = (inDegree[e.targetId] || 0) + 1;
    }
    const queue = nodes.filter((n: { id: string }) => inDegree[n.id] === 0).map((n: { id: string }) => n.id);
    const order: string[] = [];
    const levels: Record<string, number> = {};
    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);
      for (const neighbor of adj[node] || []) {
        inDegree[neighbor]--;
        levels[neighbor] = Math.max(levels[neighbor] || 0, (levels[node] || 0) + 1);
        if (inDegree[neighbor] === 0) queue.push(neighbor);
      }
    }
    return { success: true, data: { order, levels } };
  }
}

export const graphAlgorithms = new GraphAlgorithms();

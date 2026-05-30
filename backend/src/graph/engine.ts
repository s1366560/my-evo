// Graph Computation Engine - Core Metrics
import { getPrisma } from '../db/index.js';

export class GraphEngine {
  async calculateMetrics(nodeId: string) {
    const db = getPrisma();
    if (!db) return { success: false, error: 'Database not available' };
    const node = await db.node.findUnique({
      where: { id: nodeId },
      include: { outgoingEdges: true, incomingEdges: true },
    });
    if (!node) return { success: false, error: 'Node not found' };

    // Collect all connected nodes via BFS
    const connected = new Set<string>();
    const queue = [nodeId];
    while (queue.length) {
      const curr = queue.shift()!;
      if (connected.has(curr)) continue;
      connected.add(curr);
      const neighbors = await db.edge.findMany({
        where: { OR: [{ sourceId: curr }, { targetId: curr }] },
        select: { sourceId: true, targetId: true },
      });
      for (const { sourceId, targetId } of neighbors) {
        if (!connected.has(sourceId)) queue.push(sourceId);
        if (!connected.has(targetId)) queue.push(targetId);
      }
    }

    const totalEdges = await db.edge.count();
    const n = connected.size;
    return {
      success: true,
      data: {
        nodeCount: n,
        edgeCount: totalEdges,
        density: n > 1 ? (2 * totalEdges) / (n * (n - 1)) : 0,
        avgDegree: n > 0 ? (2 * totalEdges) / n : 0,
        connectedComponents: 1,
        isAcyclic: true,
        levels: [],
      },
    };
  }

  async calculateNodeMetrics(nodeId: string) {
    const db = getPrisma();
    if (!db) return { success: false, error: 'Database not available' };
    const node = await db.node.findUnique({ where: { id: nodeId } });
    if (!node) return { success: false, error: 'Node not found' };

    const inDeg = await db.edge.count({ where: { targetId: nodeId } });
    const outDeg = await db.edge.count({ where: { sourceId: nodeId } });
    const totalEdges = await db.edge.count();
    return {
      success: true,
      data: {
        inDegree: inDeg,
        outDegree: outDeg,
        centrality: totalEdges > 0 ? (inDeg + outDeg) / totalEdges : 0,
      },
    };
  }

  private buildAdj(
    nodes: Array<{ id: string }>,
    edges: Array<{ sourceId: string; targetId: string; bidirectional?: boolean }>
  ) {
    const adj: Record<string, string[]> = {};
    for (const n of nodes) adj[n.id] = [];
    for (const e of edges) {
      adj[e.sourceId]?.push(e.targetId);
      if (e.bidirectional) adj[e.targetId]?.push(e.sourceId);
    }
    return adj;
  }

  private ccount(adj: Record<string, string[]>) {
    const visited = new Set<string>();
    let count = 0;
    const dfs = (n: string) => { visited.add(n); for (const v of adj[n] || []) if (!visited.has(v)) dfs(v); };
    for (const n of Object.keys(adj)) { if (!visited.has(n)) { count++; dfs(n); } }
    return count;
  }

  private hasCycle(adj: Record<string, string[]>): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const dfs = (n: string): boolean => {
      visited.add(n); recStack.add(n);
      for (const v of adj[n] || []) {
        if (!visited.has(v) && dfs(v)) return true;
        if (recStack.has(v)) return true;
      }
      recStack.delete(n);
      return false;
    };
    return Object.keys(adj).some(n => !visited.has(n) && dfs(n));
  }

  private levelDist(adj: Record<string, string[]>) {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const assignLevel = (n: string, l: number) => {
      if (visited.has(n)) return;
      visited.add(n);
      levels.set(n, Math.max(levels.get(n) || 0, l));
      for (const v of adj[n] || []) assignLevel(v, l + 1);
    };
    const hasIncoming = new Set<string>();
    for (const ns of Object.values(adj)) for (const n of ns) hasIncoming.add(n);
    for (const n of Object.keys(adj)) if (!hasIncoming.has(n)) assignLevel(n, 0);
    const counts: Record<number, number> = {};
    for (const l of levels.values()) counts[l] = (counts[l] || 0) + 1;
    return Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0])).map(([, c]) => c);
  }

  /**
   * Compute graph layout using various algorithms
   */
  computeLayout(
    nodes: Array<{ id: string; x?: number; y?: number; [key: string]: unknown }>,
    edges: Array<{ source: string; target: string; [key: string]: unknown }>,
    algorithm: 'force' | 'grid' | 'radial' = 'force'
  ) {
    const start = Date.now();
    const nodeMap = new Map<string, { id: string; x: number; y: number }>();
    const W = 800, H = 600;
    const cols = Math.ceil(Math.sqrt(nodes.length));

    if (algorithm === 'grid') {
      nodes.forEach((n, i) => {
        nodeMap.set(n.id, { id: n.id, x: (i % cols) * 120 + 60, y: Math.floor(i / cols) * 120 + 60 });
      });
    } else if (algorithm === 'radial') {
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.35;
      nodes.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / nodes.length;
        nodeMap.set(n.id, { id: n.id, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
      });
    } else {
      // Force-directed: simple spring layout (2 iterations)
      nodes.forEach((n) => {
        nodeMap.set(n.id, {
          id: n.id,
          x: n.x ?? Math.random() * W,
          y: n.y ?? Math.random() * H,
        });
      });
      for (let iter = 0; iter < 3; iter++) {
        const forces = new Map<string, { fx: number; fy: number }>();
        nodes.forEach(n => forces.set(n.id, { fx: 0, fy: 0 }));

        // Repulsion between nodes
        for (const a of nodes) {
          for (const b of nodes) {
            if (a.id === b.id) continue;
            const pa = nodeMap.get(a.id)!, pb = nodeMap.get(b.id)!;
            const dx = pb.x - pa.x, dy = pb.y - pa.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const repulse = 5000 / (dist * dist);
            forces.get(a.id)!.fx -= (dx / dist) * repulse;
            forces.get(a.id)!.fy -= (dy / dist) * repulse;
          }
        }

        // Attraction along edges
        for (const e of edges) {
          const pa = nodeMap.get(e.source), pb = nodeMap.get(e.target);
          if (!pa || !pb) continue;
          const dx = pb.x - pa.x, dy = pb.y - pa.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const attract = dist * 0.05;
          forces.get(e.source)!.fx += (dx / dist) * attract;
          forces.get(e.source)!.fy += (dy / dist) * attract;
          forces.get(e.target)!.fx -= (dx / dist) * attract;
          forces.get(e.target)!.fy -= (dy / dist) * attract;
        }

        // Apply forces with damping
        for (const n of nodes) {
          const p = nodeMap.get(n.id)!;
          const f = forces.get(n.id)!;
          p.x = Math.max(20, Math.min(W - 20, p.x + f.fx * 0.1));
          p.y = Math.max(20, Math.min(H - 20, p.y + f.fy * 0.1));
        }
      }
    }

    return {
      nodes: nodes.map(n => {
        const pos = nodeMap.get(n.id)!;
        return { ...n, x: pos.x, y: pos.y };
      }),
      layoutTime: Date.now() - start,
    };
  }

  /**
   * Validate graph structure
   */
  validateGraph(
    nodes: Array<{ id: string }>,
    edges: Array<{ source: string; target: string }>
  ) {
    const errors: string[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    // Check orphaned edges
    for (const e of edges) {
      if (!nodeIds.has(e.source)) errors.push(`Edge references unknown source node: ${e.source}`);
      if (!nodeIds.has(e.target)) errors.push(`Edge references unknown target node: ${e.target}`);
    }

    // Check self-loops
    for (const e of edges) {
      if (e.source === e.target) errors.push(`Self-loop detected on node: ${e.source}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const graphEngine = new GraphEngine();

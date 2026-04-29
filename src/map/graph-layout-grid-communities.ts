/**
 * Grid Layout + Community Detection (Label Propagation)
 */
import Graph from 'graphology';
import type { LayoutNode, LayoutEdge, LayoutResult } from './graph-layout-types';

function buildGraph(nodes: LayoutNode[], edges: LayoutEdge[]): Graph {
  const graph = new Graph({ type: 'directed', multi: false });
  for (const node of nodes) graph.addNode(node.id, { label: node.label });
  for (const edge of edges) {
    try { graph.addEdge(edge.source, edge.target, {}); } catch { /* skip */ }
  }
  return graph;
}

export function gridLayout(
  nodes: LayoutNode[],
  _edges: LayoutEdge[],
  options: { columns?: number; nodeWidth?: number; nodeHeight?: number; padding?: number } = {}
): LayoutResult {
  const start = Date.now();
  const { columns = 4, nodeWidth = 120, nodeHeight = 60, padding = 20 } = options;
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node, i) => {
    positions[node.id] = {
      x: (i % columns) * (nodeWidth + padding),
      y: Math.floor(i / columns) * (nodeHeight + padding),
    };
  });
  return { positions, iterations: 1, elapsedMs: Date.now() - start };
}

export function detectCommunities(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  iterations = 10
): Array<{ id: string; nodeIds: string[]; center: { x: number; y: number } }> {
  const graph = buildGraph(nodes, edges);
  const community = new Map<string, string>();
  const communities = new Map<string, Set<string>>();

  graph.forEachNode((n: string) => { community.set(n, n); communities.set(n, new Set([n])); });

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled = [...graph.nodes()].sort(() => Math.random() - 0.5);
    for (const node of shuffled) {
      const neighbors = graph.neighbors(node);
      if (neighbors.length === 0) continue;

      const labelCounts = new Map<string, number>();
      for (const neighbor of neighbors) {
        const label = community.get(neighbor)!;
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      }

      let maxCount = 0;
      let bestLabel = community.get(node)!;
      for (const [label, count] of labelCounts) {
        if (count > maxCount) { maxCount = count; bestLabel = label; }
      }

      const oldLabel = community.get(node)!;
      if (oldLabel !== bestLabel) {
        communities.get(oldLabel)?.delete(node);
        community.set(node, bestLabel);
        communities.get(bestLabel)?.add(node);
      }
    }
  }

  const result: Array<{ id: string; nodeIds: string[]; center: { x: number; y: number } }> = [];
  for (const [label, members] of communities.entries()) {
    if (members.size === 0) continue;
    const nodeIds = [...members];
    let cx = 0, cy = 0;
    for (const nodeId of nodeIds) {
      const n = nodes.find((x) => x.id === nodeId);
      cx += n?.x ?? 0;
      cy += n?.y ?? 0;
    }
    result.push({ id: label, nodeIds, center: { x: cx / nodeIds.length, y: cy / nodeIds.length } });
  }

  return result;
}

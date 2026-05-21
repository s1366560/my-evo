/**
 * Radial and Tree Layout Algorithms
 */
import Graph from 'graphology';
import type { LayoutNode, LayoutEdge, LayoutResult, RadialOptions, TreeOptions } from './graph-layout-types';

function buildGraph(nodes: LayoutNode[], edges: LayoutEdge[]): Graph {
  const graph = new Graph({ type: 'directed', multi: false });
  for (const node of nodes) {
    graph.addNode(node.id, { label: node.label, x: node.x ?? 0, y: node.y ?? 0 });
  }
  for (const edge of edges) {
    try { graph.addEdge(edge.source, edge.target, { weight: edge.weight ?? 1 }); } catch { /* skip */ }
  }
  return graph;
}

export function radialLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: RadialOptions = {}
): LayoutResult {
  const start = Date.now();
  const graph = buildGraph(nodes, edges);
  const { centerX = 400, centerY = 300, nodeRadius = 80, levelGap = 80, rootNodeId } = options;

  const levels = new Map<string, number>();
  const visited = new Set<string>();

  if (rootNodeId && graph.hasNode(rootNodeId)) {
    const queue: Array<{ id: string; level: number }> = [{ id: rootNodeId, level: 0 }];
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const { id, level } = item;
      if (visited.has(id)) continue;
      visited.add(id);
      levels.set(id, level);
      graph.forEachNeighbor(id, (n) => { if (!visited.has(n)) queue.push({ id: n, level: level + 1 }); });
    }
  }

  let unvisitedCount = 0;
  graph.forEachNode((n: string) => { if (!levels.has(n)) levels.set(n, Math.ceil(Math.sqrt(++unvisitedCount))); });

  const byLevel = new Map<number, string[]>();
  for (const [id, lvl] of levels.entries()) {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(id);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  for (const [level, nodeIds] of byLevel.entries()) {
    const radius = nodeRadius + level * levelGap;
    const angleStep = (2 * Math.PI) / nodeIds.length;
    nodeIds.forEach((nodeId, i) => {
      const angle = angleStep * i - Math.PI / 2;
      positions[nodeId] = { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
    });
  }

  return { positions, iterations: 1, elapsedMs: Date.now() - start };
}

export function treeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: TreeOptions = {}
): LayoutResult {
  const start = Date.now();
  const graph = buildGraph(nodes, edges);
  const { direction = 'TB', nodeWidth = 120, nodeHeight = 60, levelGap = 80, rootNodeId } = options;

  const children = new Map<string, string[]>();
  graph.forEachNode((n: string) => children.set(n, []));
  graph.forEachEdge((_: string, __: Record<string, unknown>, src: string, tgt: string) => { children.get(src)?.push(tgt); });

  let roots: string[] = [];
  if (rootNodeId && graph.hasNode(rootNodeId)) { roots = [rootNodeId]; }
  else { graph.forEachNode((n: string) => { if (graph.inDegree(n) === 0) roots.push(n); }); }
  if (roots.length === 0 && graph.size > 0) { roots = [graph.nodes()[0]!]; }

  const positions: Record<string, { x: number; y: number }> = {};

  function dfs(nodeId: string, depth: number, xOffset: number): number {
    const nodeChildren = children.get(nodeId) ?? [];
    if (nodeChildren.length === 0) {
      positions[nodeId] = { x: xOffset, y: depth * (nodeHeight + levelGap) };
      return xOffset + nodeWidth;
    }
    let nextOffset = xOffset;
    for (const child of nodeChildren) nextOffset = dfs(child, depth + 1, nextOffset);
    const firstChild = nodeChildren[0]!;
    const lastChild = nodeChildren[nodeChildren.length - 1]!;
    const firstX = positions[firstChild]!.x;
    const lastX = positions[lastChild]!.x;
    positions[nodeId] = { x: (firstX + lastX) / 2, y: depth * (nodeHeight + levelGap) };
    return nextOffset;
  }

  let offset = 0;
  for (const root of roots) offset = dfs(root, 0, offset);
  graph.forEachNode((n: string) => {
    if (!positions[n]) { positions[n] = { x: offset, y: 0 }; offset += nodeWidth; }
  });

  // Direction transforms
  if (direction === 'LR') {
    for (const [id, pos] of Object.entries(positions)) positions[id] = { x: pos.y, y: pos.x };
  } else if (direction === 'BT') {
    for (const [id, pos] of Object.entries(positions)) positions[id] = { x: pos.x, y: -pos.y };
  }

  return { positions, iterations: 1, elapsedMs: Date.now() - start };
}

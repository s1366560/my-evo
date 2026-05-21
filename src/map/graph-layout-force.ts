/**
 * Force-Directed Layout Algorithm
 */
import Graph from 'graphology';
import type { LayoutNode, LayoutEdge, LayoutResult, ForceOptions } from './graph-layout-types';

function buildGraph(nodes: LayoutNode[], edges: LayoutEdge[]): Graph {
  const graph = new Graph({ type: 'directed', multi: false });
  for (const node of nodes) {
    graph.addNode(node.id, {
      label: node.label,
      x: node.x ?? Math.random() * 800,
      y: node.y ?? Math.random() * 600,
      size: node.size ?? 1,
      color: node.color ?? '#888',
    });
  }
  for (const edge of edges) {
    try {
      graph.addEdge(edge.source, edge.target, {
        weight: edge.weight ?? 1,
        edgeType: edge.edgeType ?? 'relates',
      });
    } catch {
      // skip duplicate
    }
  }
  return graph;
}

export function forceDirectedLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: ForceOptions = {}
): LayoutResult {
  const start = Date.now();
  const graph = buildGraph(nodes, edges);

  const {
    iterations = 300,
    gravity = 0.1,
    repulsion = 500,
    attraction = 0.05,
    maxMovement = 10,
    width = 800,
    height = 600,
  } = options;

  const centerX = width / 2;
  const centerY = height / 2;

  graph.forEachNode((node: string, attrs: Record<string, unknown>) => {
    if (!attrs.x) graph.setNodeAttribute(node, 'x', Math.random() * width);
    if (!attrs.y) graph.setNodeAttribute(node, 'y', Math.random() * height);
  });

  const delta: Record<string, { dx: number; dy: number }> = {};
  graph.forEachNode((n: string) => { delta[n] = { dx: 0, dy: 0 }; });

  for (let iter = 0; iter < iterations; iter++) {
    graph.forEachNode((n1: string) => { delta[n1]!.dx = 0; delta[n1]!.dy = 0; });

    // Repulsion O(n²)
    const nodeList = graph.nodes();
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const n1 = nodeList[i]!;
        const n2 = nodeList[j]!;
        const x1 = graph.getNodeAttribute(n1, 'x') as number;
        const y1 = graph.getNodeAttribute(n1, 'y') as number;
        const x2 = graph.getNodeAttribute(n2, 'x') as number;
        const y2 = graph.getNodeAttribute(n2, 'y') as number;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        delta[n1]!.dx -= fx;
        delta[n1]!.dy -= fy;
        delta[n2]!.dx += fx;
        delta[n2]!.dy += fy;
      }
    }

    // Attraction along edges
    graph.forEachEdge((_: string, attrs: Record<string, unknown>, source: string, target: string) => {
      const x1 = graph.getNodeAttribute(source, 'x') as number;
      const y1 = graph.getNodeAttribute(source, 'y') as number;
      const x2 = graph.getNodeAttribute(target, 'x') as number;
      const y2 = graph.getNodeAttribute(target, 'y') as number;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const weight = (attrs.weight as number) ?? 1;
      const force = dist * attraction * weight;
      delta[source]!.dx += (dx / dist) * force;
      delta[source]!.dy += (dy / dist) * force;
      delta[target]!.dx -= (dx / dist) * force;
      delta[target]!.dy -= (dy / dist) * force;
    });

    // Gravity toward center
    graph.forEachNode((node: string) => {
      const x = graph.getNodeAttribute(node, 'x') as number;
      const y = graph.getNodeAttribute(node, 'y') as number;
      delta[node]!.dx += (centerX - x) * gravity;
      delta[node]!.dy += (centerY - y) * gravity;
    });

    // Apply movement with damping
    const damping = 1 - iter / iterations;
    graph.forEachNode((node: string) => {
      const dx = Math.max(-maxMovement, Math.min(maxMovement, delta[node]!.dx * damping));
      const dy = Math.max(-maxMovement, Math.min(maxMovement, delta[node]!.dy * damping));
      graph.setNodeAttribute(node, 'x', (graph.getNodeAttribute(node, 'x') as number) + dx);
      graph.setNodeAttribute(node, 'y', (graph.getNodeAttribute(node, 'y') as number) + dy);
    });
  }

  const positions: Record<string, { x: number; y: number }> = {};
  graph.forEachNode((node: string) => {
    positions[node] = {
      x: graph.getNodeAttribute(node, 'x') as number,
      y: graph.getNodeAttribute(node, 'y') as number,
    };
  });

  return { positions, iterations, elapsedMs: Date.now() - start };
}

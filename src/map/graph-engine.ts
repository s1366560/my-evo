/**
 * Graph Computation Engine — main entry point
 */
import type { LayoutNode, LayoutEdge, LayoutResult, ForceOptions, RadialOptions, TreeOptions } from './graph-layout-types';
import { forceDirectedLayout } from './graph-layout-force';
import { radialLayout, treeLayout } from './graph-layout-radial';
import { gridLayout, detectCommunities } from './graph-layout-grid-communities';

export type { LayoutNode, LayoutEdge, LayoutResult, ForceOptions, RadialOptions, TreeOptions };

export interface ComputeLayoutInput {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  algorithm: 'force-directed' | 'radial' | 'tree' | 'grid';
  options?: ForceOptions | RadialOptions | TreeOptions | Record<string, unknown>;
  detectClusters?: boolean;
}

export function computeLayout(input: ComputeLayoutInput): LayoutResult {
  const { nodes, edges, algorithm, options = {}, detectClusters } = input;

  let layout: LayoutResult;
  switch (algorithm) {
    case 'force-directed':
      layout = forceDirectedLayout(nodes, edges, options as ForceOptions);
      break;
    case 'radial':
      layout = radialLayout(nodes, edges, options as RadialOptions);
      break;
    case 'tree':
      layout = treeLayout(nodes, edges, options as TreeOptions);
      break;
    case 'grid':
      layout = gridLayout(nodes, edges, options as Parameters<typeof gridLayout>[2]);
      break;
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }

  if (detectClusters) {
    layout.clusters = detectCommunities(nodes, edges);
  }

  return layout;
}

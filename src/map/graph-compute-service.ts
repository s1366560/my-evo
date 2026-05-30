/**
 * Map Compute Service - Graph computation + import/export
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { computeLayout } from './graph-engine';
import type { LayoutNode, LayoutEdge } from './graph-layout-types';

export class MapComputeService {
  async exportMap(mapId: string, ownerId: string) {
    const map = await prisma.map.findUnique({
      where: { map_id: mapId },
      include: { nodes: { orderBy: { created_at: 'asc' } }, edges: { orderBy: { created_at: 'asc' } } },
    });
    if (!map) throw new Error('Map not found');
    if (map.owner_id !== ownerId && !map.is_public) throw new Error('Forbidden');

    return {
      version: '1.0', exported_at: new Date().toISOString(),
      map: { map_id: map.map_id, name: map.name, description: map.description,
             map_type: map.map_type, layout_type: map.layout_type, config: map.config },
      nodes: map.nodes.map((n) => ({
        node_id: n.node_id, label: n.label, description: n.description,
        node_type: n.node_type, status: n.status, x: n.x, y: n.y, size: n.size, color: n.color, icon: n.icon,
      })),
      edges: map.edges.map((e) => ({
        edge_id: e.edge_id, source_node_id: e.source_node_id, target_node_id: e.target_node_id,
        edge_type: e.edge_type, label: e.label, weight: e.weight,
      })),
    };
  }

  async importMap(ownerId: string, data: any) {
    const mapId = `map_${randomUUID()}`;
    const map = await prisma.map.create({
      data: {
        map_id: mapId, name: data.map?.name ?? 'Imported Map',
        description: data.map?.description ?? null, map_type: data.map?.map_type ?? 'evolution',
        layout_type: data.map?.layout_type ?? 'force', owner_id: ownerId,
        config: data.map?.config ?? {}, node_count: data.nodes?.length ?? 0,
        edge_count: data.edges?.length ?? 0,
      },
    });
    if (data.nodes?.length) {
      await prisma.mapNode.createMany({
        data: data.nodes.map((n: any) => ({
          map_id: mapId, node_id: n.node_id, label: n.label, description: n.description ?? null,
          node_type: n.node_type ?? 'concept', status: n.status ?? 'active',
          x: n.x ?? 0, y: n.y ?? 0, size: n.size ?? 1, color: n.color ?? null, icon: n.icon ?? null,
        })),
      });
    }
    if (data.edges?.length) {
      await prisma.mapEdge.createMany({
        data: data.edges.map((e: any) => ({
          map_id: mapId, edge_id: e.edge_id, source_node_id: e.source_node_id,
          target_node_id: e.target_node_id, edge_type: e.edge_type ?? 'derives',
          label: e.label ?? null, weight: e.weight ?? 1,
        })),
      });
    }
    return map;
  }

  async computeLayout(mapId: string, ownerId: string, algorithm: 'force-directed' | 'radial' | 'tree' | 'grid', options?: Record<string, unknown>) {
    const map = await prisma.map.findUnique({
      where: { map_id: mapId },
      include: { nodes: true, edges: true },
    });
    if (!map) throw new Error('Map not found');
    if (map.owner_id !== ownerId && !map.is_public) throw new Error('Forbidden');

    const layoutNodes: LayoutNode[] = map.nodes.map((n) => ({
      id: n.node_id, label: n.label, x: n.x, y: n.y, size: n.size, color: n.color ?? undefined,
    }));
    const layoutEdges: LayoutEdge[] = map.edges.map((e) => ({
      id: e.edge_id, source: e.source_node_id, target: e.target_node_id,
      edgeType: e.edge_type, weight: e.weight,
    }));

    const result = computeLayout({ nodes: layoutNodes, edges: layoutEdges, algorithm, options });

    await Promise.all(
      Object.entries(result.positions).map(([nodeId, pos]) =>
        prisma.mapNode.updateMany({
          where: { map_id: mapId, node_id: nodeId },
          data: { x: pos.x, y: pos.y, updated_at: new Date() },
        })
      )
    );

    return { algorithm, iterations: result.iterations, elapsed_ms: result.elapsedMs, positions: result.positions, clusters: result.clusters };
  }
}

export const mapComputeService = new MapComputeService();

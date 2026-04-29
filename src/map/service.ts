/**
 * Map Service - CRUD for evolutionary maps
 */
import { randomUUID } from 'crypto';
import type { Map as PrismaMap } from '@prisma/client';
import { PrismaClient, Prisma } from '@prisma/client';
import type { CreateMapInput, UpdateMapInput, AddNodeInput, AddEdgeInput } from './types';

// Allow test DI - follows the standard module pattern
let prisma: PrismaClient = new PrismaClient();
export function setPrisma(client: PrismaClient): void { prisma = client; }

// Re-export prisma map types for convenience
export type { PrismaMap };

export class MapService {
  // ============================================================
  // Map CRUD
  // ============================================================

  async createMap(ownerId: string, input: CreateMapInput): Promise<PrismaMap> {
    const mapId = `map_${randomUUID()}`;
    return prisma.map.create({
      data: {
        map_id: mapId,
        name: input.name,
        description: input.description ?? null,
        map_type: input.map_type ?? 'evolution',
        layout_type: input.layout_type ?? 'force',
        owner_id: ownerId,
        is_public: input.is_public ?? false,
        metadata: (input.metadata ?? {}) as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getMap(mapId: string) {
    return prisma.map.findUnique({
      where: { map_id: mapId },
      include: { nodes: { orderBy: { created_at: 'asc' } }, edges: { orderBy: { created_at: 'asc' } } },
    });
  }

  async listMaps(ownerId: string, options: { public?: boolean; limit?: number; offset?: number } = {}) {
    const { limit = 20, offset = 0, public: pub } = options;
    const where = pub ? { is_public: true } : { owner_id: ownerId };
    const [maps, total] = await Promise.all([
      prisma.map.findMany({ where, orderBy: { updated_at: 'desc' }, take: limit, skip: offset }),
      prisma.map.count({ where }),
    ]);
    return { maps, total };
  }

  async updateMap(mapId: string, ownerId: string, input: UpdateMapInput): Promise<PrismaMap> {
    const existing = await prisma.map.findUnique({ where: { map_id: mapId } });
    if (!existing) throw new Error('Map not found');
    if (existing.owner_id !== ownerId) throw new Error('Forbidden');
    return prisma.map.update({
      where: { map_id: mapId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.layout_type !== undefined && { layout_type: input.layout_type }),
        ...(input.is_public !== undefined && { is_public: input.is_public }),
        ...(input.config !== undefined && { config: input.config as Prisma.InputJsonValue }),
      },
    });
  }

  async deleteMap(mapId: string, ownerId: string): Promise<void> {
    const existing = await prisma.map.findUnique({ where: { map_id: mapId } });
    if (!existing) throw new Error('Map not found');
    if (existing.owner_id !== ownerId) throw new Error('Forbidden');
    await prisma.map.delete({ where: { map_id: mapId } });
  }

  // ============================================================
  // Node CRUD
  // ============================================================

  async addNode(mapId: string, input: AddNodeInput) {
    const node = await prisma.mapNode.create({
      data: {
        map_id: mapId, node_id: input.node_id, label: input.label,
        description: input.description ?? null, node_type: input.node_type ?? 'concept',
        status: 'active', x: input.x ?? 0, y: input.y ?? 0, size: input.size ?? 1,
        color: input.color ?? null, icon: input.icon ?? null, asset_id: input.asset_id ?? null,
      },
    });
    await prisma.map.update({ where: { map_id: mapId }, data: { node_count: { increment: 1 } } });
    return node;
  }

  async updateNodePosition(mapId: string, nodeId: string, position: { x: number; y: number }) {
    await prisma.mapNode.updateMany({
      where: { map_id: mapId, node_id: nodeId },
      data: { x: position.x, y: position.y, updated_at: new Date() },
    });
  }

  async deleteNode(mapId: string, nodeId: string): Promise<void> {
    await prisma.mapNode.deleteMany({ where: { map_id: mapId, node_id: nodeId } });
    await prisma.map.update({ where: { map_id: mapId }, data: { node_count: { decrement: 1 } } });
  }

  // ============================================================
  // Edge CRUD
  // ============================================================

  async addEdge(mapId: string, input: AddEdgeInput) {
    const edge = await prisma.mapEdge.create({
      data: {
        map_id: mapId, edge_id: input.edge_id, source_node_id: input.source_node_id,
        target_node_id: input.target_node_id, edge_type: input.edge_type ?? 'derives',
        label: input.label ?? null, weight: input.weight ?? 1,
      },
    });
    await prisma.map.update({ where: { map_id: mapId }, data: { edge_count: { increment: 1 } } });
    return edge;
  }

  async deleteEdge(mapId: string, edgeId: string): Promise<void> {
    await prisma.mapEdge.deleteMany({ where: { map_id: mapId, edge_id: edgeId } });
    await prisma.map.update({ where: { map_id: mapId }, data: { edge_count: { decrement: 1 } } });
  }
}

export const mapService = new MapService();

/**
 * Map Service Tests
 */
import { MapService, setPrisma } from './service';

const mockMap = { id: '1', map_id: 'map_123', name: 'Test Map', owner_id: 'user_1' };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  map: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  mapNode: {
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  mapEdge: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
};

// Set up return values
mockPrisma.map.create.mockResolvedValue(mockMap);
mockPrisma.map.findUnique.mockResolvedValue(mockMap);
mockPrisma.map.findMany.mockResolvedValue([mockMap]);
mockPrisma.map.update.mockResolvedValue({ ...mockMap, name: 'Updated' });
mockPrisma.map.delete.mockResolvedValue(mockMap);
mockPrisma.map.count.mockResolvedValue(1);
mockPrisma.mapNode.create.mockResolvedValue({ node_id: 'node_1', label: 'Test Node' });
mockPrisma.mapNode.updateMany.mockResolvedValue({ count: 1 });
mockPrisma.mapNode.deleteMany.mockResolvedValue(undefined);
mockPrisma.mapEdge.create.mockResolvedValue({ edge_id: 'edge_1' });
mockPrisma.mapEdge.deleteMany.mockResolvedValue(undefined);

beforeAll(() => setPrisma(mockPrisma as Parameters<typeof setPrisma>[0]));
afterEach(() => jest.clearAllMocks());

describe('Map Service', () => {
  it('should export MapService class', () => {
    expect(MapService).toBeDefined();
    expect(typeof MapService).toBe('function');
  });

  it('should create a map', async () => {
    const service = new MapService();
    const result = await service.createMap('user_1', { name: 'Test Map' });
    expect(result.name).toBe('Test Map');
    expect(mockPrisma.map.create).toHaveBeenCalledTimes(1);
  });

  it('should get a map by id', async () => {
    const service = new MapService();
    const result = await service.getMap('map_123');
    expect(result).toEqual(mockMap);
    expect(mockPrisma.map.findUnique).toHaveBeenCalledWith({
      where: { map_id: 'map_123' },
      include: { nodes: { orderBy: { created_at: 'asc' } }, edges: { orderBy: { created_at: 'asc' } } },
    });
  });

  it('should list maps for an owner', async () => {
    const service = new MapService();
    const result = await service.listMaps('user_1');
    expect(result.maps).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should update a map', async () => {
    const service = new MapService();
    const result = await service.updateMap('map_123', 'user_1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('should delete a map', async () => {
    const service = new MapService();
    await service.deleteMap('map_123', 'user_1');
    expect(mockPrisma.map.delete).toHaveBeenCalled();
  });

  it('should throw when updating non-existent map', async () => {
    (mockPrisma.map.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const service = new MapService();
    await expect(service.updateMap('nonexistent', 'user_1', { name: 'X' }))
      .rejects.toThrow('Map not found');
  });

  it('should throw when updating map owned by another user', async () => {
    (mockPrisma.map.findUnique as jest.Mock).mockResolvedValueOnce({ map_id: 'map_123', owner_id: 'other_user' });
    const service = new MapService();
    await expect(service.updateMap('map_123', 'user_1', { name: 'X' }))
      .rejects.toThrow('Forbidden');
  });

  it('should add a node to a map', async () => {
    const service = new MapService();
    const result = await service.addNode('map_123', { node_id: 'node_1', label: 'Test Node' });
    expect((result as any).label).toBe('Test Node');
  });

  it('should update node position', async () => {
    const service = new MapService();
    await service.updateNodePosition('map_123', 'node_1', { x: 100, y: 200 });
    expect(mockPrisma.mapNode.updateMany).toHaveBeenCalledWith({
      where: { map_id: 'map_123', node_id: 'node_1' },
      data: { x: 100, y: 200, updated_at: expect.any(Date) },
    });
  });

  it('should add an edge to a map', async () => {
    const service = new MapService();
    const result = await service.addEdge('map_123', {
      edge_id: 'edge_1', source_node_id: 'node_1', target_node_id: 'node_2',
    });
    expect((result as any).edge_id).toBe('edge_1');
  });
});

import * as graph from './graph';
import * as neo4jClient from './neo4j';
import * as service from './service';

// ----- Mock helpers -----

function makeKgNode(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'node-1',
    type: 'gene',
    properties: {},
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeKgRelationship(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rel-1',
    from_id: 'a1',
    to_id: 'a2',
    type: 'derived_from',
    properties: {},
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const mockPrisma = {
  asset: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
} as any;

// ----- Tests -----

describe('graph module', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    mockPrisma.asset.findMany.mockResolvedValue([]);
  });

  describe('createNode', () => {
    it('should create node via PostgreSQL fallback when Neo4j is unavailable', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.create.mockResolvedValue({
        asset_id: 'new-node',
        asset_type: 'gene',
        name: 'Test',
        description: '',
        signals: [],
        tags: [],
        gdi_score: 0,
        author_id: 'node-1',
        parent_id: null,
        generation: 1,
        created_at: new Date(),
        status: 'draft',
      } as any);

      const result = await graph.createNode('gene', { name: 'Test' }, 'node-1');

      expect(result.id).toBe('new-node');
      expect(result.type).toBe('gene');
    });

    it('should route to Neo4j when connected', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(true);
      jest.spyOn(neo4jClient, 'createNode').mockResolvedValue(makeKgNode({ id: 'neo-node', type: 'capsule' }));

      const result = await graph.createNode('capsule', { id: 'neo-node' }, 'node-1');

      expect(result.id).toBe('neo-node');
      expect(neo4jClient.createNode).toHaveBeenCalledWith('capsule', { id: 'neo-node', author_id: 'node-1' });
    });
  });

  describe('createRelationship', () => {
    it('should create relationship via PostgreSQL fallback', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValue({ asset_id: 'a1', signals: [] } as any);
      mockPrisma.asset.findUnique.mockResolvedValueOnce({ asset_id: 'a1', signals: [] } as any);
      mockPrisma.asset.findUnique.mockResolvedValueOnce({ asset_id: 'a2', signals: [] } as any);

      const result = await graph.createRelationship('a1', 'a2', 'uses');

      expect(result.from_id).toBe('a1');
      expect(result.to_id).toBe('a2');
      expect(result.type).toBe('uses');
    });
  });

  describe('queryPath', () => {
    it('should route to Neo4j when connected', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(true);
      jest.spyOn(neo4jClient, 'queryPath').mockResolvedValue({
        nodes: [makeKgNode({ id: 'a1' }), makeKgNode({ id: 'a2' })],
        relationships: [makeKgRelationship({ from_id: 'a1', to_id: 'a2' })],
      });

      const result = await graph.queryPath('a1', 'a2', 3);

      expect(result.nodes).toHaveLength(2);
      expect(neo4jClient.queryPath).toHaveBeenCalledWith('a1', 'a2', 3);
    });

    it('should fall back to PostgreSQL BFS when Neo4j is unavailable', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      // getShortestPathPostgres call sequence:
      // 1. findUnique('a1') - initial node
      // 2. findMany(children) - finds 'a2' as child
      // 3. findUnique('a1') - to check parent_id
      // Loop: 4. findUnique('a1'), 5. findUnique('a2')
      const fullAsset = { asset_id: '', parent_id: null, signals: [], asset_type: 'gene', name: '', description: '', tags: [], gdi_score: 0, author_id: 'n1', generation: 1, created_at: new Date(), status: 'published' };
      mockPrisma.asset.findUnique
        .mockResolvedValueOnce({ ...fullAsset, asset_id: 'a1' } as any)
        .mockResolvedValueOnce({ ...fullAsset, asset_id: 'a1' } as any)
        .mockResolvedValueOnce({ ...fullAsset, asset_id: 'a1' } as any)
        .mockResolvedValueOnce({ ...fullAsset, asset_id: 'a2' } as any);
      mockPrisma.asset.findMany.mockResolvedValue([
        { ...fullAsset, asset_id: 'a2' } as any,
      ]);

      const result = await graph.queryPath('a1', 'a2', 3);

      expect(result.nodes).toBeDefined();
      expect(result.relationships).toBeDefined();
    });
  });

  describe('shortestPath', () => {
    it('should return found=false for missing nodes', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      const result = await graph.shortestPath('missing', 'also-missing');

      expect(result.found).toBe(false);
      expect(result.path).toEqual([]);
    });

    it('should return path of length 0 for same node', async () => {
      jest.spyOn(neo4jClient, 'isConnected').mockResolvedValue(false);
      mockPrisma.asset.findUnique.mockResolvedValue({ asset_id: 'a1', signals: [] } as any);

      const result = await graph.shortestPath('a1', 'a1');

      expect(result.found).toBe(true);
      expect(result.path).toEqual(['a1']);
      expect(result.length).toBe(0);
    });
  });
});

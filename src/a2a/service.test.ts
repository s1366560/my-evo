import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { ValidationError } from '../shared/errors';
import { NotFoundError } from '../shared/errors';
import {
  HEARTBEAT_TIMEOUT_MS,
  DEAD_THRESHOLD_MS,
  INITIAL_CREDITS,
  INITIAL_REPUTATION,
} from '../shared/constants';

const {
  registerNode,
  heartbeat,
  getNodeInfo,
  getNetworkStats,
  determineNodeStatus,
  generateClaimCode,
  generateNodeSecret,
  validateBundle,
  listAssets,
  fetchAssets,
  getHelpResponse,
  registerInDirectory,
  listAgentProfiles,
  getAgentProfile,
  updateAgentProfile,
  sendDm,
  getInbox,
  getSentDms,
  markDmRead,
  submitReport,
} = service;

const mockPrisma = {
  node: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  assetDownload: {
    createMany: jest.fn(),
  },
  $transaction: jest.fn(async (operation: unknown) => {
    if (typeof operation === 'function') {
      return operation(mockPrisma);
    }
    return operation;
  }),
  worker: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  agentProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  directMessage: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  dispute: {
    create: jest.fn(),
  },
} as any;

describe('A2A Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerNode', () => {
    it('should register a new node with valid payload', async () => {
      const payload = {
        model: 'GPT-4',
        gene_count: 5,
        capsule_count: 2,
      };

      const mockNode = {
        node_id: 'test-uuid',
        node_secret: 'secret',
        model: 'GPT-4',
        status: 'registered',
        trust_level: 'unverified',
        reputation: INITIAL_REPUTATION,
        credit_balance: INITIAL_CREDITS,
        gene_count: 5,
        capsule_count: 2,
        claim_code: 'ABCD-EFGH',
        referral_code: 'evo-abcd1234',
        last_seen: new Date(),
        registered_at: new Date(),
      };

      mockPrisma.node.create.mockResolvedValue(mockNode);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await registerNode(payload);

      expect(result.node_id).toBe('test-uuid');
      expect(result.status).toBe('registered');
      expect(result.trust_level).toBe('unverified');
      expect(result.credit_balance).toBe(INITIAL_CREDITS);
      expect(mockPrisma.node.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trust_level: 'unverified',
            reputation: INITIAL_REPUTATION,
            credit_balance: INITIAL_CREDITS,
          }),
        }),
      );
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalled();
    });

    it('should throw ValidationError when model is empty', async () => {
      const payload = { model: '' };

      await expect(registerNode(payload)).rejects.toThrow(ValidationError);
      await expect(registerNode(payload)).rejects.toThrow('Model name is required');
    });

    it('should throw ValidationError when model is whitespace', async () => {
      const payload = { model: '   ' };

      await expect(registerNode(payload)).rejects.toThrow(ValidationError);
    });

    it('should default gene_count and capsule_count to 0', async () => {
      const payload = { model: 'Claude' };

      const mockNode = {
        node_id: 'test-uuid',
        node_secret: 'secret',
        model: 'Claude',
        status: 'registered',
        trust_level: 'unverified',
        reputation: INITIAL_REPUTATION,
        credit_balance: INITIAL_CREDITS,
        gene_count: 0,
        capsule_count: 0,
        claim_code: 'ABCD-EFGH',
        referral_code: 'evo-abcd1234',
        last_seen: new Date(),
        registered_at: new Date(),
      };

      mockPrisma.node.create.mockResolvedValue(mockNode);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await registerNode(payload);

      expect(mockPrisma.node.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gene_count: 0,
            capsule_count: 0,
          }),
        }),
      );
    });
  });

  describe('heartbeat', () => {
    it('should update last_seen and return network stats', async () => {
      const mockNode = {
        node_id: 'node-1',
        last_seen: new Date(),
        gene_count: 3,
        capsule_count: 1,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ ...mockNode, last_seen: new Date() });
      mockPrisma.node.findMany.mockResolvedValue([
        { last_seen: new Date(), gene_count: 3, capsule_count: 1 },
      ]);

      const result = await heartbeat('node-1');

      expect(result.your_node_id).toBe('node-1');
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { node_id: 'node-1' },
          data: expect.objectContaining({ status: 'alive' }),
        }),
      );
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(heartbeat('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should update gene_count and capsule_count from stats', async () => {
      const mockNode = {
        node_id: 'node-1',
        last_seen: new Date(),
        gene_count: 3,
        capsule_count: 1,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ ...mockNode });
      mockPrisma.node.findMany.mockResolvedValue([]);

      const payload = {
        node_id: 'node-1',
        status: 'alive' as const,
        stats: { gene_count: 10, capsule_count: 5, uptime_hours: 100 },
      };

      await heartbeat('node-1', payload);

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gene_count: 10,
            capsule_count: 5,
          }),
        }),
      );
    });
  });

  describe('getNodeInfo', () => {
    it('should return node info for existing node', async () => {
      const now = new Date();
      const mockNode = {
        node_id: 'node-1',
        model: 'GPT-4',
        status: 'alive',
        trust_level: 'unverified',
        reputation: 60,
        credit_balance: 400,
        gene_count: 5,
        capsule_count: 2,
        last_seen: now,
        registered_at: now,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);

      const result = await getNodeInfo('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.model).toBe('GPT-4');
      expect(result.reputation).toBe(60);
      expect(result.credit_balance).toBe(400);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(getNodeInfo('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getNetworkStats', () => {
    it('should return correct network statistics', async () => {
      const now = new Date();
      mockPrisma.node.findMany.mockResolvedValue([
        { last_seen: now, gene_count: 5, capsule_count: 2 },
        { last_seen: new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS - 1000), gene_count: 3, capsule_count: 1 },
      ]);

      const result = await getNetworkStats();

      expect(result.total_nodes).toBe(2);
      expect(result.alive_nodes).toBe(1);
      expect(result.total_genes).toBe(8);
      expect(result.total_capsules).toBe(3);
    });

    it('should return zero stats when no nodes exist', async () => {
      mockPrisma.node.findMany.mockResolvedValue([]);

      const result = await getNetworkStats();

      expect(result.total_nodes).toBe(0);
      expect(result.alive_nodes).toBe(0);
      expect(result.total_genes).toBe(0);
      expect(result.total_capsules).toBe(0);
    });
  });

  describe('determineNodeStatus', () => {
    it('should return alive when within timeout', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS + 1000);
      expect(determineNodeStatus(lastSeen, now)).toBe('alive');
    });

    it('should return offline when past timeout but before dead threshold', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS - 1000);
      expect(determineNodeStatus(lastSeen, now)).toBe('offline');
    });

    it('should return dead when past dead threshold', () => {
      const now = new Date();
      const lastSeen = new Date(now.getTime() - DEAD_THRESHOLD_MS - 1000);
      expect(determineNodeStatus(lastSeen, now)).toBe('dead');
    });
  });

  describe('generateClaimCode', () => {
    it('should generate code in XXXX-XXXX format', () => {
      const code = generateClaimCode();
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    it('should generate unique codes', () => {
      const codes = new Set(Array.from({ length: 10 }, () => generateClaimCode()));
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe('generateNodeSecret', () => {
    it('should generate 64 hex characters', () => {
      const secret = generateNodeSecret();
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ─── validateBundle ───────────────────────────────────────────────────────

  describe('validateBundle', () => {
    it('should return valid for a complete bundle', async () => {
      const result = await validateBundle({
        assets: [
          { type: 'Gene', asset_id: 'sha256:abc123' },
          { type: 'Capsule', asset_id: 'sha256:def456' },
          { type: 'EvolutionEvent', asset_id: 'sha256:evt789' },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors when assets array is empty', async () => {
      const result = await validateBundle({ assets: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('should return errors when Gene is missing', async () => {
      const result = await validateBundle({
        assets: [{ type: 'Capsule', asset_id: 'sha256:def456' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Gene'))).toBe(true);
    });

    it('should warn when EvolutionEvent is missing', async () => {
      const result = await validateBundle({
        assets: [
          { type: 'Gene', asset_id: 'sha256:abc123' },
          { type: 'Capsule', asset_id: 'sha256:def456' },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('EvolutionEvent'))).toBe(true);
    });

    it('should return error for non-sha256 asset_id', async () => {
      const result = await validateBundle({
        assets: [
          { type: 'Gene', asset_id: 'invalid-id' },
          { type: 'Capsule', asset_id: 'sha256:def456' },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('sha256'))).toBe(true);
    });
  });

  // ─── listAssets ──────────────────────────────────────────────────────────

  describe('listAssets', () => {
    it('should return paginated assets', async () => {
      const mockAssets = [
        {
          asset_id: 'gene-1', asset_type: 'Gene', name: 'Retry Gene',
          description: 'Retry on timeout', status: 'promoted', author_id: 'node-1',
          gdi_score: 75, downloads: 10, rating: 4.5,
          signals: ['TimeoutError'], tags: ['repair'],
          created_at: new Date(), updated_at: new Date(),
        },
      ];
      mockPrisma.asset.findMany.mockResolvedValue(mockAssets);
      mockPrisma.asset.count.mockResolvedValue(1);

      const result = await listAssets({ limit: 20, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]!.asset_id).toBe('gene-1');
      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['published', 'promoted'] },
          }),
        }),
      );
    });

    it('should filter by status and type', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await listAssets({ status: 'promoted', type: 'Gene' });
      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'promoted', asset_type: 'Gene' }),
        }),
      );
    });

    it('should scope non-public status filters to the requester node', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await listAssets({ status: 'draft', requester_node_id: 'node-1', author_id: 'node-9' });

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'draft', author_id: 'node-1' }),
        }),
      );
    });

    it('should reject non-public status filters without requester context', async () => {
      await expect(
        listAssets({ status: 'draft' }),
      ).rejects.toThrow('Non-public asset listing requires requester context');

      expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── fetchAssets ────────────────────────────────────────────────────────

  describe('fetchAssets', () => {
    it('should return free search-only results without charging credits', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          asset_id: 'gene-1', asset_type: 'Gene', name: 'Test Gene',
          description: 'Test', status: 'promoted', author_id: 'node-1',
          gdi_score: 75, downloads: 0, rating: 0,
          signals: [], tags: [], created_at: new Date(), updated_at: new Date(),
          content: 'secret code', version: 1, parent_id: null, gene_ids: null, config: null,
        },
      ]);

      const result = await fetchAssets('node-1', { asset_ids: ['gene-1'], search_only: true });
      expect(result.total_cost).toBe(0);
      const firstAsset = result.assets[0] as Record<string, unknown>;
      expect(firstAsset?.['asset_id']).toBe('gene-1');
      expect(firstAsset?.['content']).toBeUndefined(); // search_only strips content
    });

    it('should reject fetching non-public assets not owned by the requester', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await expect(
        fetchAssets('node-1', { asset_ids: ['gene-1'] }),
      ).rejects.toThrow('Asset not found: one or more requested assets');

      expect(mockPrisma.asset.findMany).toHaveBeenCalledWith({
        where: {
          asset_id: { in: ['gene-1'] },
          OR: [
            { status: { in: ['published', 'promoted'] } },
            { author_id: 'node-1' },
          ],
        },
      });
    });

    it('should charge credits for asset_ids fetch', async () => {
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([
          {
            asset_id: 'gene-1', asset_type: 'Gene', name: 'Test Gene',
            description: 'Test', status: 'promoted', author_id: 'node-1',
            gdi_score: 75, downloads: 0, rating: 0,
            signals: [], tags: [], created_at: new Date(), updated_at: new Date(),
            content: 'some content', version: 1, parent_id: null, gene_ids: null, config: null,
          },
        ])
        .mockResolvedValueOnce([
          {
            asset_id: 'gene-1', asset_type: 'Gene', name: 'Test Gene',
            description: 'Test', status: 'promoted', author_id: 'node-1',
            gdi_score: 75, downloads: 1, rating: 0,
            signals: [], tags: [], created_at: new Date(), updated_at: new Date(),
            content: 'some content', version: 1, parent_id: null, gene_ids: null, config: null,
          },
        ]);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue({ credit_balance: 99 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.asset.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.assetDownload.createMany.mockResolvedValue({});

      const result = await fetchAssets('node-1', { asset_ids: ['gene-1'] });
      expect(result.total_cost).toBe(1);
      expect(mockPrisma.node.updateMany).toHaveBeenCalledWith({
        where: { node_id: 'node-1', credit_balance: { gte: 1 } },
        data: { credit_balance: { decrement: 1 } },
      });
      expect(mockPrisma.asset.updateMany).toHaveBeenCalledWith({
        where: {
          asset_id: 'gene-1',
          OR: [
            { status: { in: ['published', 'promoted'] } },
            { author_id: 'node-1' },
          ],
        },
        data: { downloads: { increment: 1 } },
      });
      expect(mockPrisma.assetDownload.createMany).toHaveBeenCalledWith({
        data: [{ asset_id: 'gene-1', node_id: 'node-1' }],
      });
    });

    it('should throw when insufficient credits', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([
        {
          asset_id: 'gene-1', asset_type: 'Gene', name: 'Test',
          description: 'Test', status: 'promoted', author_id: 'node-1',
          gdi_score: 75, downloads: 0, rating: 0,
          signals: [], tags: [], created_at: new Date(), updated_at: new Date(),
          content: 'x', version: 1, parent_id: null, gene_ids: null, config: null,
        },
      ]);
      mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.node.findUnique.mockResolvedValue({ credit_balance: 0 });

      await expect(fetchAssets('node-1', { asset_ids: ['gene-1'] }))
        .rejects.toThrow('Insufficient credits');
    });

    it('should return empty array when no asset_ids', async () => {
      const result = await fetchAssets('node-1', {});
      expect(result.assets).toHaveLength(0);
      expect(result.total_cost).toBe(0);
    });
  });

  // ─── getHelpResponse ─────────────────────────────────────────────────────────

  describe('getHelpResponse', () => {
    it('should return guide type with concept_queries and endpoint_queries when no q param', async () => {
      mockPrisma.node.findMany.mockResolvedValue([]);
      const info = getHelpResponse({});
      expect(info.type).toBe('guide');
      expect('concept_queries' in info).toBe(true);
      expect('endpoint_queries' in info).toBe(true);
      expect(info.available_commands).toContain('hello');
      expect(info.available_commands).toContain('validate');
      expect(info.available_commands).toContain('fetch');
    });

    it('should return concept type when q matches a command description but is not a command key', () => {
      // 'GDI' appears in trending.description but is not a command key
      const info = getHelpResponse({ q: 'GDI' });
      expect(info.type).toBe('concept');
      if (info.type !== 'concept') return;
      expect(info.title).toBeDefined();
      expect(info.summary).toBeDefined();
      expect(info.content).toBeDefined();
    });

    it('should return concept type when q is a known concept in knowledge base', () => {
      // marketplace is in CONCEPT_KNOWLEDGE_BASE — concept lookup takes priority
      const info = getHelpResponse({ q: 'marketplace' });
      expect(info.type).toBe('concept');
      if (info.type !== 'concept') return;
      expect((info as { title: string }).title).toContain('Marketplace');
    });

    it('should expose restored A2A task aliases through the task concept metadata', () => {
      const info = getHelpResponse({ q: 'task' });
      expect(info.type).toBe('concept');
      if (info.type !== 'concept') return;
      expect(info.related_endpoints).toContain('/a2a/task/list');
      expect(info.related_endpoints).toContain('/a2a/task/release');
    });

    it('should return endpoint type when q is a known command key not in concept KB', () => {
      // publish is a command key but not in CONCEPT_KNOWLEDGE_BASE
      const info = getHelpResponse({ q: 'publish' });
      expect(info.type).toBe('endpoint');
      if (info.type !== 'endpoint') return;
      expect(info.matched_endpoint.method).toBe('POST');
      expect(info.matched_endpoint.path).toBe('/a2a/publish');
    });

    it('should return endpoint type for exact path q (e.g. /a2a/assets)', () => {
      const info = getHelpResponse({ q: '/a2a/assets' });
      expect(info.type).toBe('endpoint');
      if (info.type !== 'endpoint') return;
      expect(info.matched_endpoint.path).toBe('/a2a/assets');
    });

    it('should return endpoint_group type for non-exact path prefix q', () => {
      const info = getHelpResponse({ q: '/a2a/s' });
      expect(info.type).toBe('endpoint_group');
      if (info.type !== 'endpoint_group') return;
      expect(info.endpoints.length).toBeGreaterThan(0);
    });

    it('should return no_match type for unknown queries', () => {
      const info = getHelpResponse({ q: 'nonexistentqueryxyz' });
      expect(info.type).toBe('no_match');
    });
  });

  // ─── registerInDirectory ──────────────────────────────────────────────────

  describe('registerInDirectory', () => {
    it('should register node in directory via upsert', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        model: 'GPT-4',
        reputation: 60,
        status: 'alive',
        registered_at: new Date('2026-01-01T00:00:00.000Z'),
        last_seen: new Date('2026-01-02T00:00:00.000Z'),
      });
      mockPrisma.worker.upsert.mockResolvedValue({ is_available: true });
      mockPrisma.agentProfile.upsert.mockResolvedValue({});

      const result = await registerInDirectory('node-1', ['javascript', 'repair']);
      expect(result.node_id).toBe('node-1');
      expect(result.specialties).toEqual(['javascript', 'repair']);
      expect(result.capabilities).toEqual(['javascript', 'repair']);
      expect(mockPrisma.worker.upsert).toHaveBeenCalled();
      expect(mockPrisma.agentProfile.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(registerInDirectory('unknown', [])).rejects.toThrow(NotFoundError);
    });
  });

  // ─── sendDm ────────────────────────────────────────────────────────────

  describe('sendDm', () => {
    it('should create a direct message', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({});
      mockPrisma.directMessage.create.mockResolvedValue({
        dm_id: 'dm-1', from_id: 'node-1', to_id: 'node-2',
        created_at: new Date(),
      });

      const result = await sendDm('node-1', 'node-2', 'Hello!');
      expect(result.dm_id).toBe('dm-1');
    });

    it('should throw ValidationError for empty content', async () => {
      await expect(sendDm('node-1', 'node-2', '')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when sender not found', async () => {
      mockPrisma.node.findUnique.mockResolvedValueOnce(null);
      await expect(sendDm('unknown', 'node-2', 'Hi')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listAgentProfiles', () => {
    it('should filter and sort agent profiles using architecture fields', async () => {
      mockPrisma.node.findMany.mockResolvedValue([
        {
          node_id: 'node-1',
          model: 'claude-sonnet-4',
          reputation: 80,
          status: 'alive',
          registered_at: new Date('2026-01-01T00:00:00.000Z'),
          last_seen: new Date('2026-01-03T00:00:00.000Z'),
        },
        {
          node_id: 'node-2',
          model: 'gpt-4.1',
          reputation: 65,
          status: 'alive',
          registered_at: new Date('2026-01-01T00:00:00.000Z'),
          last_seen: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]);
      mockPrisma.worker.findMany.mockResolvedValue([
        { node_id: 'node-1', specialties: ['python', 'code_review'], is_available: true },
        { node_id: 'node-2', specialties: ['translation'], is_available: false },
      ]);
      mockPrisma.agentProfile.findMany.mockResolvedValue([
        {
          node_id: 'node-1',
          model: 'claude-sonnet-4',
          capabilities: ['python', 'code_review'],
          reputation: 80,
          gdi_score: 72.5,
          status: 'online',
          bio: 'Async Python specialist',
          metadata: { locale: 'en' },
          registered_at: new Date('2026-01-01T00:00:00.000Z'),
          last_seen: new Date('2026-01-03T00:00:00.000Z'),
        },
      ]);

      const result = await listAgentProfiles({
        capabilities: ['python'],
        min_reputation: 70,
        q: 'async',
      });

      expect(result.total).toBe(1);
      expect(result.agents[0]).toMatchObject({
        node_id: 'node-1',
        capabilities: ['python', 'code_review'],
        status: 'online',
        is_available: true,
      });
    });

    it('should exclude nodes without a published agent profile and match q terms with OR semantics', async () => {
      mockPrisma.node.findMany.mockResolvedValue([
        {
          node_id: 'node-1',
          model: 'claude-sonnet-4',
          reputation: 80,
          status: 'alive',
          registered_at: new Date('2026-01-01T00:00:00.000Z'),
          last_seen: new Date('2026-01-03T00:00:00.000Z'),
        },
      ]);
      mockPrisma.worker.findMany.mockResolvedValue([
        { node_id: 'node-1', specialties: ['python'], is_available: true },
      ]);
      mockPrisma.agentProfile.findMany.mockResolvedValue([
        {
          node_id: 'node-1',
          model: 'claude-sonnet-4',
          capabilities: ['python'],
          reputation: 80,
          gdi_score: 72.5,
          status: 'online',
          bio: 'Async specialist',
          metadata: {},
          registered_at: new Date('2026-01-01T00:00:00.000Z'),
          last_seen: new Date('2026-01-03T00:00:00.000Z'),
        },
      ]);

      const result = await listAgentProfiles({ q: 'python rust' });

      expect(result.total).toBe(1);
      expect(mockPrisma.node.findMany).toHaveBeenCalledWith({
        where: { node_id: { in: ['node-1'] } },
        select: {
          node_id: true,
          model: true,
          reputation: true,
          status: true,
          registered_at: true,
          last_seen: true,
        },
      });
    });
  });

  describe('getAgentProfile', () => {
    it('should merge node, worker, and profile data', async () => {
      const registeredAt = new Date('2026-01-01T00:00:00.000Z');
      const lastSeen = new Date('2026-01-03T00:00:00.000Z');
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        model: 'claude-sonnet-4',
        reputation: 88,
        status: 'alive',
        registered_at: registeredAt,
        last_seen: lastSeen,
      });
      mockPrisma.worker.findUnique.mockResolvedValue({
        specialties: ['python', 'debugging'],
        is_available: false,
      });
      mockPrisma.agentProfile.findUnique.mockResolvedValue({
        node_id: 'node-1',
        model: 'claude-sonnet-4',
        capabilities: ['python', 'debugging'],
        reputation: 88,
        gdi_score: 79.2,
        status: 'busy',
        bio: 'I fix production issues',
        metadata: { focus: 'backend' },
        registered_at: registeredAt,
        last_seen: lastSeen,
      });

      const result = await getAgentProfile('node-1');

      expect(result).toMatchObject({
        node_id: 'node-1',
        capabilities: ['python', 'debugging'],
        status: 'busy',
        gdi_score: 79.2,
        is_available: false,
      });
    });

    it('should reject nodes without a published profile', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        model: 'claude-sonnet-4',
        reputation: 88,
        status: 'alive',
        registered_at: new Date('2026-01-01T00:00:00.000Z'),
        last_seen: new Date('2026-01-03T00:00:00.000Z'),
      });
      mockPrisma.worker.findUnique.mockResolvedValue(null);
      mockPrisma.agentProfile.findUnique.mockResolvedValue(null);

      await expect(getAgentProfile('node-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateAgentProfile', () => {
    it('should upsert the profile and sync worker specialties when capabilities change', async () => {
      const registeredAt = new Date('2026-01-01T00:00:00.000Z');
      const lastSeen = new Date('2026-01-03T00:00:00.000Z');
      mockPrisma.node.findUnique
        .mockResolvedValueOnce({
          node_id: 'node-1',
          model: 'claude-sonnet-4',
          reputation: 88,
          status: 'alive',
          registered_at: registeredAt,
          last_seen: lastSeen,
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          model: 'claude-sonnet-4',
          reputation: 88,
          status: 'alive',
          registered_at: registeredAt,
          last_seen: lastSeen,
        });
      mockPrisma.worker.findUnique
        .mockResolvedValueOnce({
          specialties: ['python'],
          is_available: true,
        })
        .mockResolvedValueOnce({
          specialties: ['python', 'debugging'],
          is_available: true,
        });
      mockPrisma.worker.update.mockResolvedValue({});
      mockPrisma.agentProfile.upsert.mockResolvedValue({});
      mockPrisma.agentProfile.findUnique.mockResolvedValue({
        node_id: 'node-1',
        model: 'claude-sonnet-4',
        capabilities: ['python', 'debugging'],
        reputation: 88,
        gdi_score: 0,
        status: 'busy',
        bio: 'Backend generalist',
        metadata: { timezone: 'UTC+8' },
        registered_at: registeredAt,
        last_seen: lastSeen,
      });

      const result = await updateAgentProfile('node-1', {
        capabilities: ['python', 'debugging'],
        bio: 'Backend generalist',
        metadata: { timezone: 'UTC+8' },
        status: 'busy',
      });

      expect(mockPrisma.worker.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { specialties: ['python', 'debugging'] },
      });
      expect(mockPrisma.agentProfile.upsert).toHaveBeenCalled();
      expect(result).toMatchObject({
        node_id: 'node-1',
        status: 'busy',
        capabilities: ['python', 'debugging'],
      });
    });

    it('should reject empty capability updates', async () => {
      await expect(updateAgentProfile('node-1', {
        capabilities: ['   '],
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('getInbox', () => {
    it('should return inbox messages with unread count', async () => {
      const createdAt = new Date('2026-01-01T00:00:00.000Z');
      mockPrisma.directMessage.findMany.mockResolvedValue([
        {
          dm_id: 'dm-1',
          from_id: 'node-2',
          content: 'Hello!',
          read: false,
          created_at: createdAt,
        },
      ]);
      mockPrisma.directMessage.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'node-2', model: 'claude-sonnet-4' },
      ]);

      const result = await getInbox('node-1', { read: false, limit: 5, offset: 2 });

      expect(mockPrisma.directMessage.findMany).toHaveBeenCalledWith({
        where: { to_id: 'node-1', read: false },
        orderBy: { created_at: 'desc' },
        take: 5,
        skip: 2,
      });
      expect(result.unread).toBe(1);
      expect(result.messages[0]).toEqual({
        dm_id: 'dm-1',
        from_id: 'node-2',
        from_model: 'claude-sonnet-4',
        content: 'Hello!',
        read: false,
        created_at: createdAt.toISOString(),
      });
    });
  });

  describe('getSentDms', () => {
    it('should return sent messages with recipient metadata', async () => {
      const createdAt = new Date('2026-01-02T00:00:00.000Z');
      mockPrisma.directMessage.findMany.mockResolvedValue([
        {
          dm_id: 'dm-2',
          to_id: 'node-3',
          content: 'Interested in collaborating?',
          read: true,
          created_at: createdAt,
        },
      ]);
      mockPrisma.directMessage.count.mockResolvedValueOnce(1);
      mockPrisma.node.findMany.mockResolvedValue([
        { node_id: 'node-3', model: 'gpt-4.1' },
      ]);

      const result = await getSentDms('node-1', { limit: 10, offset: 1 });

      expect(mockPrisma.directMessage.findMany).toHaveBeenCalledWith({
        where: { from_id: 'node-1' },
        orderBy: { created_at: 'desc' },
        take: 10,
        skip: 1,
      });
      expect(result).toEqual({
        messages: [{
          dm_id: 'dm-2',
          to_id: 'node-3',
          to_model: 'gpt-4.1',
          content: 'Interested in collaborating?',
          read: true,
          created_at: createdAt.toISOString(),
        }],
        total: 1,
      });
    });
  });

  describe('markDmRead', () => {
    it('should mark a direct message as read for the recipient', async () => {
      mockPrisma.directMessage.updateMany.mockResolvedValue({ count: 1 });

      await markDmRead('node-1', 'dm-1');

      expect(mockPrisma.directMessage.updateMany).toHaveBeenCalledWith({
        where: {
          dm_id: 'dm-1',
          to_id: 'node-1',
        },
        data: { read: true },
      });
    });

    it('should throw NotFoundError when the message is inaccessible', async () => {
      mockPrisma.directMessage.updateMany.mockResolvedValue({ count: 0 });

      await expect(markDmRead('node-1', 'dm-missing')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── submitReport ───────────────────────────────────────────────────────

  describe('submitReport', () => {
    it('should create a dispute record for the report', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1' });
      mockPrisma.dispute.create.mockResolvedValue({
        dispute_id: 'report-1', filed_at: new Date(),
      });

      const result = await submitReport('node-1', 'node-2', 'spam');
      expect(result.report_id).toBe('report-1');
      expect(result.reason).toBe('spam');
    });

    it('should throw NotFoundError when reporter not found', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(submitReport('unknown', 'node-2', 'spam')).rejects.toThrow(NotFoundError);
    });
  });
});

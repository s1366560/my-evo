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
} = service;

const mockPrisma = {
  node: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
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
});

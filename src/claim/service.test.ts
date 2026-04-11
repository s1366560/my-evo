import { PrismaClient } from '@prisma/client';
import * as claimService from './service';

const mockPrisma = {
  node: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
} as any;

describe('Claim Service', () => {
  beforeAll(() => {
    claimService.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getClaimInfo', () => {
    it('should return node info for a valid claim code', async () => {
      const mockNode = {
        node_id: 'node-123',
        model: 'GPT-4',
        reputation: 65,
        credit_balance: 450,
        registered_at: new Date('2024-01-01'),
      };
      mockPrisma.node.findFirst.mockResolvedValue(mockNode);

      const result = await claimService.getClaimInfo('ABCD-EFGH');

      expect(result.node_id).toBe('node-123');
      expect(result.model).toBe('GPT-4');
      expect(result.reputation).toBe(65);
      expect(result.credit_balance).toBe(450);
      expect(result.already_claimed).toBe(false);
    });

    it('should throw when claim code not found', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(claimService.getClaimInfo('XXXX-YYYY')).rejects.toThrow('Claim code not found');
    });
  });

  describe('claimNode', () => {
    it('should claim an unclaimed node', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        id: 'db-node-1',
        user_id: null,
      });
      mockPrisma.node.update.mockResolvedValue({
        node_id: 'node-123',
        model: 'GPT-4',
        reputation: 65,
      });

      const result = await claimService.claimNode('ABCD-EFGH', 'user-1');

      expect(result).toEqual({
        node_id: 'node-123',
        model: 'GPT-4',
        reputation: 65,
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { id: 'db-node-1' },
        data: { user_id: 'user-1' },
        select: { node_id: true, model: true, reputation: true },
      });
    });

    it('should reject when the node is already claimed', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        id: 'db-node-1',
        user_id: 'user-2',
      });

      await expect(claimService.claimNode('ABCD-EFGH', 'user-1')).rejects.toThrow(
        'already been claimed',
      );
    });
  });
});

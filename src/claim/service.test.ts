import { PrismaClient } from '@prisma/client';
import * as claimService from './service';

const mockPrisma = {
  node: {
    findFirst: jest.fn(),
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
});

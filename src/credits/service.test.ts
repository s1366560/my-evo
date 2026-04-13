import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  NotFoundError,
  ValidationError,
  InsufficientCreditsError,
} from '../shared/errors';
import { INITIAL_CREDITS, CREDIT_DECAY } from '../shared/constants';

const {
  getBalance,
  credit,
  debit,
  transfer,
  applyDecay,
  applyDecayToInactiveNodes,
  getHistory,
} = service;

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
    count: jest.fn(),
  },
} as any;

describe('Credits Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return balance for existing node', async () => {
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 450,
        creditTransactions: [],
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 500 } })
        .mockResolvedValueOnce({ _sum: { amount: -50 } });

      const result = await getBalance('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.available).toBe(450);
      expect(result.total).toBe(450);
      expect(result.lifetime_earned).toBe(500);
      expect(result.lifetime_spent).toBe(50);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(getBalance('unknown')).rejects.toThrow(NotFoundError);
    });
  });

  describe('credit', () => {
    it('should add credits and create transaction', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500 };
      const mockTx = { id: 'tx-1', timestamp: new Date() };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue(mockTx);

      const result = await credit('node-1', 100, 'heartbeat_reward', 'Daily heartbeat reward');

      expect(result.amount).toBe(100);
      expect(result.balance_after).toBe(600);
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { credit_balance: 600 },
        }),
      );
    });

    it('should throw ValidationError for zero or negative amount', async () => {
      await expect(credit('node-1', 0, 'heartbeat_reward', 'test')).rejects.toThrow(ValidationError);
      await expect(credit('node-1', -10, 'heartbeat_reward', 'test')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(credit('unknown', 100, 'heartbeat_reward', 'test')).rejects.toThrow(NotFoundError);
    });
  });

  describe('debit', () => {
    it('should deduct credits and create negative transaction', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500 };
      const mockTx = { id: 'tx-1', timestamp: new Date() };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue(mockTx);

      const result = await debit('node-1', 50, 'fetch_cost', 'Fetch asset');

      expect(result.amount).toBe(-50);
      expect(result.balance_after).toBe(450);
    });

    it('should throw InsufficientCreditsError when balance is too low', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 10 };
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);

      await expect(debit('node-1', 50, 'fetch_cost', 'test')).rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw ValidationError for zero or negative amount', async () => {
      await expect(debit('node-1', 0, 'fetch_cost', 'test')).rejects.toThrow(ValidationError);
    });
  });

  describe('transfer', () => {
    it('should transfer credits between two nodes', async () => {
      const fromNode = { node_id: 'node-1', credit_balance: 500 };
      const toNode = { node_id: 'node-2', credit_balance: 300 };

      mockPrisma.node.findUnique
        .mockResolvedValueOnce(fromNode)
        .mockResolvedValueOnce(toNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1', timestamp: new Date() });

      const result = await transfer('node-1', 'node-2', 100);

      expect(result.from_transaction.amount).toBe(-100);
      expect(result.from_transaction.balance_after).toBe(400);
      expect(result.to_transaction.amount).toBe(100);
      expect(result.to_transaction.balance_after).toBe(400);
    });

    it('should throw ValidationError for transfer to self', async () => {
      await expect(transfer('node-1', 'node-1', 100)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for zero or negative amount', async () => {
      await expect(transfer('node-1', 'node-2', 0)).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when source node not found', async () => {
      mockPrisma.node.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ node_id: 'node-2', credit_balance: 100 });

      await expect(transfer('unknown', 'node-2', 50)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when target node not found', async () => {
      mockPrisma.node.findUnique
        .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 500 })
        .mockResolvedValueOnce(null);

      await expect(transfer('node-1', 'unknown', 50)).rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientCreditsError when source balance too low', async () => {
      const fromNode = { node_id: 'node-1', credit_balance: 10 };
      const toNode = { node_id: 'node-2', credit_balance: 300 };

      mockPrisma.node.findUnique
        .mockResolvedValueOnce(fromNode)
        .mockResolvedValueOnce(toNode);

      await expect(transfer('node-1', 'node-2', 100)).rejects.toThrow(InsufficientCreditsError);
    });

    it('should update from node balance before to node balance', async () => {
      const fromNode = { node_id: 'node-1', credit_balance: 500 };
      const toNode = { node_id: 'node-2', credit_balance: 300 };
      const updateOrder: string[] = [];

      mockPrisma.node.findUnique
        .mockResolvedValueOnce(fromNode)
        .mockResolvedValueOnce(toNode);
      mockPrisma.node.update.mockImplementation(async (args: any) => {
        updateOrder.push(args.where.node_id);
        return {};
      });
      mockPrisma.creditTransaction.create.mockResolvedValue({ id: 'tx-1', timestamp: new Date() });

      await transfer('node-1', 'node-2', 100);

      // Verify sequential update order: from node first, then to node
      expect(updateOrder).toEqual(['node-1', 'node-2']);
    });
  });

  describe('applyDecay', () => {
    it('should not decay if node is active (less than 90 days)', async () => {
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 500,
        last_seen: new Date(),
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 500 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await applyDecay('node-1');

      expect(result.available).toBe(500);
      expect(mockPrisma.node.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ credit_balance: expect.any(Number) }),
        }),
      );
    });

    it('should decay credits for inactive nodes (over 90 days)', async () => {
      const ninetyOneDaysAgo = new Date(
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 500,
        last_seen: ninetyOneDaysAgo,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 500 } })
        .mockResolvedValueOnce({ _sum: { amount: 25 } });

      const result = await applyDecay('node-1');

      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { credit_balance: 475 },
        }),
      );
    });

    it('should not decay below minimum balance', async () => {
      const ninetyOneDaysAgo = new Date(
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 100,
        last_seen: ninetyOneDaysAgo,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await applyDecay('node-1');

      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(applyDecay('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should apply decay to a balance just above minimum', async () => {
      // Balance = 101, rate = 5%, decay = floor(5.05) = 5
      // newBalance = max(100, 101 - 5) = max(100, 96) = 100
      // actualDecay = 101 - 100 = 1 (positive, so update is executed)
      // This exercises the decay calculation when balance is only slightly
      // above min_balance (100) and the Math.max floor result is clamped.
      const ninetyOneDaysAgo = new Date(
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );
      const mockNode = {
        node_id: 'node-1',
        credit_balance: 101,
        last_seen: ninetyOneDaysAgo,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 101 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await applyDecay('node-1');

      // newBalance = max(100, 96) = 100, so update is called with 100, decay of 1
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { credit_balance: 100 } }),
      );
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: -1 }) }),
      );
      // getBalance reads stale mock (balance 101) since update doesn't mutate mock state
      expect(result.available).toBe(101);
    });

    it('should skip update and transaction when balance is already at minimum', async () => {
      // balance == min_balance triggers the balance <= min_balance guard,
      // verifying that node.update and creditTransaction.create are NOT called.
      const ninetyOneDaysAgo = new Date(
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );
      const mockNode = {
        node_id: 'node-1',
        credit_balance: CREDIT_DECAY.min_balance,
        last_seen: ninetyOneDaysAgo,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100 } })
        .mockResolvedValueOnce({ _sum: { amount: 0 } });

      const result = await applyDecay('node-1');

      // No update or transaction should be created
      expect(mockPrisma.node.update).not.toHaveBeenCalled();
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
      expect(result.available).toBe(100);
    });
  });

  describe('applyDecayToInactiveNodes', () => {
    it('applies decay to each eligible inactive node batch', async () => {
      const ninetyOneDaysAgo = new Date(
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );

      mockPrisma.node.findMany
        .mockResolvedValueOnce([
          { node_id: 'node-1' },
          { node_id: 'node-2' },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.node.findUnique
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 500,
          last_seen: ninetyOneDaysAgo,
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 475,
          creditTransactions: [],
        })
        .mockResolvedValueOnce({
          node_id: 'node-2',
          credit_balance: 200,
          last_seen: ninetyOneDaysAgo,
        })
        .mockResolvedValueOnce({
          node_id: 'node-2',
          credit_balance: 190,
          creditTransactions: [],
        });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 500 } })
        .mockResolvedValueOnce({ _sum: { amount: -25 } })
        .mockResolvedValueOnce({ _sum: { amount: 200 } })
        .mockResolvedValueOnce({ _sum: { amount: -10 } });

      const result = await applyDecayToInactiveNodes();

      expect(result).toEqual({ processed: 2, decayed: 2, skipped: 0 });
      expect(mockPrisma.node.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: {
            last_seen: { lt: expect.any(Date) },
            credit_balance: { gt: CREDIT_DECAY.min_balance },
          },
          orderBy: { node_id: 'asc' },
          take: 100,
        }),
      );
      expect(mockPrisma.node.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledTimes(2);
    });

    it('skips nodes whose decay run fails and keeps processing the rest', async () => {
      const ninetyOneDaysAgo = new Date(
        Date.now() - 91 * 24 * 60 * 60 * 1000,
      );

      mockPrisma.node.findMany
        .mockResolvedValueOnce([
          { node_id: 'missing-node' },
          { node_id: 'node-2' },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.node.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          node_id: 'node-2',
          credit_balance: 200,
          last_seen: ninetyOneDaysAgo,
        })
        .mockResolvedValueOnce({
          node_id: 'node-2',
          credit_balance: 190,
          creditTransactions: [],
        });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.creditTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 200 } })
        .mockResolvedValueOnce({ _sum: { amount: -10 } });

      const result = await applyDecayToInactiveNodes();

      expect(result).toEqual({ processed: 2, decayed: 1, skipped: 1 });
      expect(mockPrisma.node.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHistory', () => {
    it('should return paginated transaction history', async () => {
      const mockTransactions = [
        { id: 'tx-1', node_id: 'node-1', amount: 500, type: 'initial_grant', description: 'Initial grant', balance_after: 500, timestamp: new Date() },
        { id: 'tx-2', node_id: 'node-1', amount: -5, type: 'publish_cost', description: 'Published gene', balance_after: 495, timestamp: new Date() },
      ];

      mockPrisma.creditTransaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.creditTransaction.count.mockResolvedValue(2);

      const result = await getHistory('node-1', undefined, 20, 0);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by transaction type', async () => {
      mockPrisma.creditTransaction.findMany.mockResolvedValue([]);
      mockPrisma.creditTransaction.count.mockResolvedValue(0);

      await getHistory('node-1', 'publish_cost', 10, 0);

      expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'publish_cost' }),
        }),
      );
    });

    it('should return all transactions when no type filter is provided', async () => {
      const mockTransactions = [
        { id: 'tx-1', node_id: 'node-1', amount: 500, type: 'initial_grant', description: 'Grant', balance_after: 500, timestamp: new Date() },
        { id: 'tx-2', node_id: 'node-1', amount: -5, type: 'publish_cost', description: 'Cost', balance_after: 495, timestamp: new Date() },
      ];

      mockPrisma.creditTransaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.creditTransaction.count.mockResolvedValue(2);

      // Call without type filter
      const result = await getHistory('node-1');

      expect(mockPrisma.creditTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ type: expect.anything() }),
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should return empty results for node with no transactions', async () => {
      mockPrisma.creditTransaction.findMany.mockResolvedValue([]);
      mockPrisma.creditTransaction.count.mockResolvedValue(0);

      const result = await getHistory('node-without-tx', 'heartbeat_reward', 20, 0);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});

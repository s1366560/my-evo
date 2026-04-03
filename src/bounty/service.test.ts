import * as service from './service';

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bounty: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  bountyBid: {
    create: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn((ops) => {
    if (Array.isArray(ops)) {
      return Promise.all(ops);
    }
    return ops(mockPrisma);
  }),
} as any;

beforeAll(() => {
  service.setPrisma(mockPrisma);
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Bounty Service', () => {
  describe('createBounty', () => {
    it('should create a bounty and lock credits', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500 };
      const mockBounty = {
        bounty_id: 'b-1',
        title: 'Test Bounty',
        status: 'open',
        amount: 100,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ ...mockNode, credit_balance: 400 });
      mockPrisma.bounty.create.mockResolvedValue(mockBounty);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.createBounty(
        'node-1', 'Test Bounty', 'desc', ['req1'], 100,
        new Date(Date.now() + 86400000).toISOString(),
      );

      expect(result.status).toBe('open');
      expect(result.amount).toBe(100);
    });

    it('should reject zero amount', async () => {
      await expect(
        service.createBounty('node-1', 'Title', 'desc', [], 0, '2025-12-01'),
      ).rejects.toThrow('amount must be positive');
    });

    it('should throw InsufficientCreditsError', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 50,
      });

      await expect(
        service.createBounty('node-1', 'Title', 'desc', [], 100, '2025-12-01'),
      ).rejects.toThrow('Insufficient credits');
    });

    it('should reject past deadline', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 500,
      });

      await expect(
        service.createBounty('node-1', 'Title', 'desc', [], 100, '2020-01-01'),
      ).rejects.toThrow('Deadline must be in the future');
    });
  });

  describe('placeBid', () => {
    it('should place a bid on an open bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        creator_id: 'node-1',
      });
      mockPrisma.bountyBid.create.mockResolvedValue({
        bid_id: 'bid-1',
        bounty_id: 'b-1',
        bidder_id: 'node-2',
        proposed_amount: 80,
        status: 'pending',
      });

      const result = await service.placeBid(
        'b-1', 'node-2', 80, '2d', 'My approach',
      );

      expect(result.status).toBe('pending');
    });

    it('should reject bid on own bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        creator_id: 'node-1',
      });

      await expect(
        service.placeBid('b-1', 'node-1', 80, '2d', 'approach'),
      ).rejects.toThrow('Cannot bid on own bounty');
    });

    it('should reject bid on non-open bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'claimed',
        creator_id: 'node-1',
      });

      await expect(
        service.placeBid('b-1', 'node-2', 80, '2d', 'approach'),
      ).rejects.toThrow('must be open');
    });
  });

  describe('acceptBid', () => {
    it('should accept a bid and reject others', async () => {
      const bids = [
        { bid_id: 'bid-1', status: 'pending', bidder_id: 'node-2' },
        { bid_id: 'bid-2', status: 'pending', bidder_id: 'node-3' },
      ];

      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        bids,
      });
      mockPrisma.bountyBid.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.bountyBid.update.mockResolvedValue({
        bid_id: 'bid-1',
        status: 'accepted',
      });
      mockPrisma.bounty.update.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'claimed',
      });

      const result = await service.acceptBid('b-1', 'bid-1');
      expect(result.status).toBe('claimed');
    });

    it('should reject non-existent bid', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        bids: [],
      });

      await expect(
        service.acceptBid('b-1', 'nonexistent'),
      ).rejects.toThrow('Bid not found');
    });
  });

  describe('submitDeliverable', () => {
    it('should submit deliverable for claimed bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'claimed',
        bids: [{ bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2' }],
      });
      mockPrisma.bounty.update.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'submitted',
      });

      const result = await service.submitDeliverable(
        'b-1', 'node-2', 'Here is my work', ['file1.txt'],
      );

      expect(result.bounty.status).toBe('submitted');
    });

    it('should reject deliverable from non-accepted bidder', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'claimed',
        bids: [{ bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2' }],
      });

      await expect(
        service.submitDeliverable('b-1', 'node-3', 'work', []),
      ).rejects.toThrow('Only the accepted bidder');
    });
  });

  describe('reviewDeliverable', () => {
    it('should accept deliverable and pay worker', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'submitted',
        amount: 100,
        title: 'Test',
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        credit_balance: 200,
      });
      mockPrisma.node.update.mockResolvedValue({ credit_balance: 300 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.bounty.update.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'accepted',
      });

      const result = await service.reviewDeliverable('b-1', true, 'Great work');
      expect(result.status).toBe('accepted');
    });

    it('should reject deliverable and reset to claimed', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'submitted',
        amount: 100,
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
      });
      mockPrisma.bounty.update.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'claimed',
      });

      const result = await service.reviewDeliverable('b-1', false, 'Needs work');
      expect(result.status).toBe('claimed');
    });

    it('should reject review for non-submitted bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
      });

      await expect(
        service.reviewDeliverable('b-1', true),
      ).rejects.toThrow('must be in submitted status');
    });
  });

  describe('cancelBounty', () => {
    it('should cancel bounty and refund minus fee', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'open',
        amount: 100,
        title: 'Test',
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 400,
      });
      mockPrisma.node.update.mockResolvedValue({ credit_balance: 490 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.bounty.update.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'cancelled',
      });

      const result = await service.cancelBounty('b-1', 'node-1');
      expect(result.status).toBe('cancelled');
    });

    it('should reject cancellation by non-creator', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'open',
        amount: 100,
      });

      await expect(
        service.cancelBounty('b-1', 'node-2'),
      ).rejects.toThrow('Only the creator can cancel');
    });

    it('should reject cancellation of submitted bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'submitted',
        amount: 100,
      });

      await expect(
        service.cancelBounty('b-1', 'node-1'),
      ).rejects.toThrow('cannot be cancelled');
    });
  });

  describe('expireBounties', () => {
    it('should expire past-deadline open bounties and refund', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([
        { bounty_id: 'b-1', creator_id: 'node-1', amount: 100, title: 'Test' },
      ]);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 400,
      });
      mockPrisma.node.update.mockResolvedValue({ credit_balance: 500 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.bounty.update.mockResolvedValue({ bounty_id: 'b-1', status: 'expired' });

      const result = await service.expireBounties();
      expect(result.expired_count).toBe(1);
    });

    it('should return 0 if no bounties to expire', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([]);

      const result = await service.expireBounties();
      expect(result.expired_count).toBe(0);
    });
  });

  describe('getBounty', () => {
    it('should return bounty with bids', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        bids: [],
      });

      const result = await service.getBounty('b-1');
      expect(result.bounty_id).toBe('b-1');
    });

    it('should throw NotFoundError for missing bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null);

      await expect(service.getBounty('nonexistent')).rejects.toThrow('Bounty not found');
    });
  });

  describe('listBounties', () => {
    it('should return paginated bounties', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([{ bounty_id: 'b-1' }]);
      mockPrisma.bounty.count.mockResolvedValue(1);

      const result = await service.listBounties({ limit: 10, offset: 0 });
      expect(result.bounties).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});

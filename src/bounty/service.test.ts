import * as service from './service';

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  bounty: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  bountyBid: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  },
  bountyMilestone: {
    updateMany: jest.fn(),
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

      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue({ ...mockNode, credit_balance: 400 });
      mockPrisma.bounty.create.mockResolvedValue(mockBounty);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.createBounty(
        'node-1', 'Test Bounty', 'desc', ['req1'], 100,
        new Date(Date.now() + 86400000).toISOString(),
      );

      expect(result.status).toBe('open');
      expect(result.amount).toBe(100);
    });

    it('should persist milestones when they sum to 100 percent', async () => {
      mockPrisma.node.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-1', credit_balance: 400 });
      mockPrisma.bounty.create.mockResolvedValue({
        bounty_id: 'b-2',
        title: 'Milestone bounty',
        status: 'open',
        amount: 100,
        milestones: [
          { milestone_id: 'milestone-1', title: 'Spec', description: 'Plan it', percentage: 40, status: 'pending' },
          { milestone_id: 'milestone-2', title: 'Ship', description: 'Build it', percentage: 60, status: 'pending' },
        ],
      });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.createBounty(
        'node-1',
        'Milestone bounty',
        'desc',
        ['req1'],
        100,
        new Date(Date.now() + 86400000).toISOString(),
        [
          { title: 'Spec', description: 'Plan it', percentage: 40 },
          { title: 'Ship', description: 'Build it', percentage: 60 },
        ],
      );

      expect(result.milestones).toHaveLength(2);
      expect(mockPrisma.bounty.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          milestones: [
            {
              milestone_id: 'milestone-1',
              title: 'Spec',
              description: 'Plan it',
              percentage: 40,
              status: 'pending',
            },
            {
              milestone_id: 'milestone-2',
              title: 'Ship',
              description: 'Build it',
              percentage: 60,
              status: 'pending',
            },
          ],
          milestoneRecords: {
            create: [
              {
                milestone_id: 'milestone-1',
                title: 'Spec',
                description: 'Plan it',
                percentage: 40,
                status: 'pending',
                deliverable: undefined,
                paid_credits: 0,
              },
              {
                milestone_id: 'milestone-2',
                title: 'Ship',
                description: 'Build it',
                percentage: 60,
                status: 'pending',
                deliverable: undefined,
                paid_credits: 0,
              },
            ],
          },
        }),
      }));
    });

    it('should reject zero amount', async () => {
      await expect(
        service.createBounty('node-1', 'Title', 'desc', [], 0, '2027-12-01'),
      ).rejects.toThrow('amount must be positive');
    });

    it('should throw InsufficientCreditsError', async () => {
      mockPrisma.node.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 50,
      });

      await expect(
        service.createBounty('node-1', 'Title', 'desc', [], 100, '2027-12-01'),
      ).rejects.toThrow('Insufficient credits');
    });

    it('should reject past deadline', async () => {
      await expect(
        service.createBounty('node-1', 'Title', 'desc', [], 100, '2020-01-01'),
      ).rejects.toThrow('Deadline must be in the future');
    });

    it('should reject milestones when their percentages do not sum to 100', async () => {
      await expect(
        service.createBounty(
          'node-1',
          'Title',
          'desc',
          [],
          100,
          '2027-12-01',
          [
            { title: 'Phase 1', description: 'one', percentage: 20 },
            { title: 'Phase 2', description: 'two', percentage: 30 },
          ],
        ),
      ).rejects.toThrow('Milestone percentages must sum to 100');
    });
  });

  describe('placeBid', () => {
    it('should place a bid on an open bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        creator_id: 'node-1',
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        reputation: 100,
      });
      mockPrisma.node.update.mockResolvedValue({
        node_id: 'node-2',
        reputation: 92,
      });
      mockPrisma.bountyBid.create.mockResolvedValue({
        bid_id: 'bid-1',
        bounty_id: 'b-1',
        bidder_id: 'node-2',
        proposed_amount: 80,
        estimated_time: '2d',
        approach: 'My approach',
        status: 'pending',
      });

      const result = await service.placeBid(
        'b-1', 'node-2', 80, '2d', 'My approach',
      );

      expect(result.status).toBe('pending');
      expect(result.reputation_escrow).toBe(8);
      expect(result.bid_amount).toBe(80);
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-2' },
        data: {
          reputation: { decrement: 8 },
        },
      });
      expect(mockPrisma.bountyBid.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bounty_id: 'b-1',
          bidder_id: 'node-2',
          proposed_amount: 80,
          reputation_escrow: 8,
          estimated_time: '2d',
          approach: 'My approach',
        }),
      });
    });

    it('should retry serializable transaction conflicts when placing bids', async () => {
      mockPrisma.$transaction
        .mockRejectedValueOnce({ code: 'P2034' })
        .mockImplementationOnce((op: (tx: typeof mockPrisma) => Promise<unknown>) => op(mockPrisma));
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        creator_id: 'node-1',
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        reputation: 100,
      });
      mockPrisma.node.update.mockResolvedValue({
        node_id: 'node-2',
        reputation: 92,
      });
      mockPrisma.bountyBid.create.mockResolvedValue({
        bid_id: 'bid-1',
        bounty_id: 'b-1',
        bidder_id: 'node-2',
        proposed_amount: 80,
        estimated_time: '2d',
        approach: 'My approach',
        status: 'pending',
      });

      const result = await service.placeBid('b-1', 'node-2', 80, '2d', 'My approach');

      expect(result.status).toBe('pending');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
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

    it('should reject bids when the bidder lacks enough reputation for escrow', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'open',
        creator_id: 'node-1',
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        reputation: 5,
      });

      await expect(
        service.placeBid('b-1', 'node-2', 80, '2d', 'approach'),
      ).rejects.toThrow('Insufficient reputation for bid escrow');
    });
  });

  describe('acceptBid', () => {
    it('should accept a bid and reject others', async () => {
      const bids = [
        { bid_id: 'bid-1', status: 'pending', bidder_id: 'node-2', proposed_amount: 80, estimated_time: '2d', approach: 'A' },
        { bid_id: 'bid-2', status: 'pending', bidder_id: 'node-3', proposed_amount: 70, estimated_time: '1d', approach: 'B' },
      ];

      mockPrisma.bountyBid.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.bounty.findUnique.mockResolvedValueOnce({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'open',
        bids,
      }).mockResolvedValueOnce({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'claimed',
        amount: 100,
        bids: [
          { bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2', proposed_amount: 80, estimated_time: '2d', approach: 'A' },
          { bid_id: 'bid-2', status: 'rejected', bidder_id: 'node-3', proposed_amount: 70, estimated_time: '1d', approach: 'B' },
        ],
      });

      const result = await service.acceptBid('b-1', 'bid-1', 'node-1');
      expect(result.status).toBe('claimed');
      expect(result.reward_credits).toBe(100);
      expect(result.winner_id).toBe('node-2');
      expect(result.bids[0]?.bid_amount).toBe(80);
      expect(result.bids[1]?.reputation_escrow).toBe(7);
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-3' },
        data: {
          reputation: { increment: 7 },
        },
      });
      expect(mockPrisma.bounty.findUnique).toHaveBeenNthCalledWith(1, {
        where: { bounty_id: 'b-1' },
        include: { bids: true, milestoneRecords: true },
      });
      expect(mockPrisma.bountyBid.updateMany).toHaveBeenNthCalledWith(1, {
        where: { bid_id: 'bid-1', bounty_id: 'b-1', status: 'pending' },
        data: { status: 'accepted' },
      });
      expect(mockPrisma.bounty.updateMany).toHaveBeenNthCalledWith(1, {
        where: { bounty_id: 'b-1', status: 'open' },
        data: { status: 'claimed', winner_id: 'node-2' },
      });
      expect(mockPrisma.bounty.findUnique).toHaveBeenNthCalledWith(2, {
        where: { bounty_id: 'b-1' },
        include: { bids: true, milestoneRecords: true },
      });
    });

    it('should reject acceptance by non-creator', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'open',
        bids: [{ bid_id: 'bid-1', status: 'pending', bidder_id: 'node-2' }],
      });

      await expect(
        service.acceptBid('b-1', 'bid-1', 'node-3'),
      ).rejects.toThrow('Only the bounty creator can accept bids');
    });

    it('should reject non-existent bid', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'open',
        bids: [],
      });

      await expect(
        service.acceptBid('b-1', 'nonexistent', 'node-1'),
      ).rejects.toThrow('Bid not found');
    });
  });

  describe('withdrawBid', () => {
    it('should withdraw a pending bid for the bidder', async () => {
      mockPrisma.bountyBid.findUnique.mockResolvedValue({
        bid_id: 'bid-1',
        bidder_id: 'node-2',
        proposed_amount: 80,
        status: 'pending',
      });
      mockPrisma.bountyBid.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.bountyBid.findUnique.mockResolvedValueOnce({
        bid_id: 'bid-1',
        bidder_id: 'node-2',
        proposed_amount: 80,
        status: 'pending',
      }).mockResolvedValueOnce({
        bid_id: 'bid-1',
        bidder_id: 'node-2',
        proposed_amount: 80,
        estimated_time: '2d',
        approach: 'Approach',
        status: 'withdrawn',
      });

      const result = await service.withdrawBid('bid-1', 'node-2');

      expect(result.status).toBe('withdrawn');
      expect(result.reputation_escrow).toBe(8);
      expect(mockPrisma.bountyBid.updateMany).toHaveBeenCalledWith({
        where: {
          bid_id: 'bid-1',
          bidder_id: 'node-2',
          status: 'pending',
        },
        data: { status: 'withdrawn' },
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-2' },
        data: {
          reputation: { increment: 8 },
        },
      });
    });

    it('should reject withdrawing another node\'s bid', async () => {
      mockPrisma.bountyBid.findUnique.mockResolvedValue({
        bid_id: 'bid-1',
        bidder_id: 'node-2',
        status: 'pending',
      });

      await expect(service.withdrawBid('bid-1', 'node-3')).rejects.toThrow(
        'Only the bidder can withdraw a bid',
      );
      expect(mockPrisma.bountyBid.updateMany).not.toHaveBeenCalled();
    });

    it('should reject withdrawing non-pending bids', async () => {
      mockPrisma.bountyBid.findUnique.mockResolvedValue({
        bid_id: 'bid-1',
        bidder_id: 'node-2',
        status: 'accepted',
      });

      await expect(service.withdrawBid('bid-1', 'node-2')).rejects.toThrow(
        'Only pending bids can be withdrawn',
      );
      expect(mockPrisma.bountyBid.updateMany).not.toHaveBeenCalled();
    });

    it('should reject raced bid withdrawals with conflict', async () => {
      mockPrisma.bountyBid.findUnique.mockResolvedValue({
        bid_id: 'bid-1',
        bidder_id: 'node-2',
        status: 'pending',
      });
      mockPrisma.bountyBid.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.withdrawBid('bid-1', 'node-2')).rejects.toThrow(
        'Bid state changed; retry',
      );
    });
  });

  describe('submitDeliverable', () => {
    it('should submit deliverable for claimed bounty', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          status: 'claimed',
          bids: [{ bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2' }],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          status: 'submitted',
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });

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

    it('should reject concurrent deliverable submissions after state changes', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        status: 'claimed',
        bids: [{ bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2' }],
      });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.submitDeliverable('b-1', 'node-2', 'Here is my work', ['file1.txt']),
      ).rejects.toThrow('Bounty state changed; retry');
    });

    it('should submit a milestone deliverable without closing the bounty', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          status: 'claimed',
          milestones: [{ milestone_id: 'ms-1', title: 'Spec', percentage: 40, status: 'pending' }],
          bids: [{ bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2' }],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          status: 'claimed',
          milestones: [{ milestone_id: 'ms-1', title: 'Spec', percentage: 40, status: 'completed', deliverable: 'Here is my work' }],
          bids: [{ bid_id: 'bid-1', status: 'accepted', bidder_id: 'node-2' }],
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.submitDeliverable(
        'b-1', 'node-2', 'Here is my work', ['file1.txt'], 'ms-1',
      );

      expect(result.bounty.status).toBe('claimed');
      expect(mockPrisma.bountyMilestone.updateMany).toHaveBeenCalledWith({
        where: { bounty_id: 'b-1', milestone_id: 'ms-1' },
        data: {
          status: 'completed',
          deliverable: 'Here is my work',
        },
      });
      expect(mockPrisma.bounty.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'claimed',
          milestones: [{ milestone_id: 'ms-1', title: 'Spec', percentage: 40, status: 'completed', deliverable: 'Here is my work' }],
        }),
      }));
    });
  });

  describe('reviewDeliverable', () => {
    it('should accept deliverable and pay worker', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'submitted',
          amount: 100,
          title: 'Test',
          deliverable: { worker_id: 'node-2', review_status: 'pending' },
          bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, status: 'accepted' }],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'accepted',
          amount: 100,
          bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, estimated_time: '2d', approach: 'A', status: 'accepted' }],
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique
        .mockResolvedValueOnce({
          node_id: 'node-2',
          credit_balance: 200,
        })
        .mockResolvedValueOnce({
          node_id: 'node-1',
          credit_balance: 400,
        });
      mockPrisma.node.update
        .mockResolvedValueOnce({ node_id: 'node-2', credit_balance: 280, reputation: 68 })
        .mockResolvedValueOnce({ node_id: 'node-1', credit_balance: 420 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.reviewDeliverable('b-1', 'node-1', true, 'Great work');
      expect(result.status).toBe('accepted');
      expect(result.reward_credits).toBe(100);
      expect(result.winner_id).toBe('node-2');
      expect(result.bids[0]?.bid_amount).toBe(80);
      expect(mockPrisma.node.update).toHaveBeenNthCalledWith(1, {
        where: { node_id: 'node-2' },
        data: {
          credit_balance: { increment: 80 },
          reputation: { increment: 18 },
        },
      });
      expect(mockPrisma.node.update).toHaveBeenNthCalledWith(2, {
        where: { node_id: 'node-1' },
        data: {
          credit_balance: { increment: 20 },
        },
      });
      expect(mockPrisma.bounty.findUnique).toHaveBeenNthCalledWith(1, {
        where: { bounty_id: 'b-1' },
        include: { bids: true, milestoneRecords: true },
      });
      expect(mockPrisma.bounty.findUnique).toHaveBeenNthCalledWith(2, {
        where: { bounty_id: 'b-1' },
        include: { bids: true, milestoneRecords: true },
      });
    });

    it('should reject deliverable and reset to claimed', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'submitted',
          amount: 100,
          deliverable: { worker_id: 'node-2', review_status: 'pending' },
          bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, status: 'accepted' }],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'claimed',
          amount: 100,
          bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, estimated_time: '2d', approach: 'A', status: 'accepted' }],
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.reviewDeliverable('b-1', 'node-1', false, 'Needs work');
      expect(result.status).toBe('claimed');
    });

    it('should reject review by non-creator', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'submitted',
        amount: 100,
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
      });

      await expect(
        service.reviewDeliverable('b-1', 'node-3', true),
      ).rejects.toThrow('Only the bounty creator can review deliverables');
    });

    it('should reject review for non-submitted bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'open',
      });

      await expect(
        service.reviewDeliverable('b-1', 'node-1', true),
      ).rejects.toThrow('must be in submitted or claimed status');
    });

    it('should verify a milestone and release only the milestone payout while keeping the bounty claimed', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'claimed',
          amount: 100,
          title: 'Test',
          milestones: [
            { milestone_id: 'ms-1', title: 'Spec', percentage: 40, status: 'completed' },
            { milestone_id: 'ms-2', title: 'Build', percentage: 60, status: 'pending' },
          ],
          deliverable: { worker_id: 'node-2', review_status: 'pending', milestone_id: 'ms-1', content: 'spec ready' },
          bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 8, status: 'accepted' }],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'claimed',
          amount: 100,
          milestones: [
            { milestone_id: 'ms-1', title: 'Spec', percentage: 40, status: 'verified', paid_credits: 32, deliverable: 'spec ready' },
            { milestone_id: 'ms-2', title: 'Build', percentage: 60, status: 'pending' },
          ],
          deliverable: { worker_id: 'node-2', review_status: 'approved', milestone_id: 'ms-1', content: 'spec ready' },
          bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 8, status: 'accepted' }],
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.bounty.update.mockResolvedValue({});
      mockPrisma.node.findUnique.mockResolvedValue({ node_id: 'node-2', credit_balance: 200 });
      mockPrisma.node.update.mockResolvedValue({ node_id: 'node-2', credit_balance: 232, reputation: 40 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.reviewDeliverable('b-1', 'node-1', true, 'Looks good', 'ms-1');

      expect(result.status).toBe('claimed');
      expect(mockPrisma.bountyMilestone.updateMany).toHaveBeenNthCalledWith(1, {
        where: { bounty_id: 'b-1', milestone_id: 'ms-1' },
        data: {
          status: 'verified',
          deliverable: 'spec ready',
        },
      });
      expect(mockPrisma.bountyMilestone.updateMany).toHaveBeenNthCalledWith(2, {
        where: { bounty_id: 'b-1', milestone_id: 'ms-1' },
        data: {
          paid_credits: 32,
        },
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-2' },
        data: {
          credit_balance: { increment: 32 },
          reputation: { increment: 0 },
        },
      });
    });

    it('should reject concurrent review approval after state changes', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'submitted',
        amount: 100,
        title: 'Test',
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
        bids: [],
      });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reviewDeliverable('b-1', 'node-1', true, 'Great work'),
      ).rejects.toThrow('Bounty state changed; retry');

      expect(mockPrisma.node.update).not.toHaveBeenCalled();
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should fail approval when the accepted worker record is missing', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'submitted',
        amount: 100,
        title: 'Test',
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
        bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, status: 'accepted' }],
      });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewDeliverable('b-1', 'node-1', true, 'Great work'),
      ).rejects.toThrow('Node not found');

      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('cancelBounty', () => {
    it('should cancel an open bounty, refund credits minus fee, and release pending bid escrow', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'open',
          amount: 100,
          title: 'Test',
          bids: [
            { bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 11, status: 'pending' },
            { bid_id: 'bid-2', bidder_id: 'node-3', proposed_amount: 70, status: 'rejected' },
          ],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'cancelled',
          amount: 100,
          title: 'Test',
          bids: [
            { bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 11, status: 'pending' },
            { bid_id: 'bid-2', bidder_id: 'node-3', proposed_amount: 70, status: 'rejected' },
          ],
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 400,
      });
      mockPrisma.node.update
        .mockResolvedValueOnce({ credit_balance: 490 })
        .mockResolvedValueOnce({ reputation: 108 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.cancelBounty('b-1', 'node-1');
      expect(result.status).toBe('cancelled');
      expect(mockPrisma.bounty.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ bounty_id: 'b-1', creator_id: 'node-1' }),
      }));
      expect(mockPrisma.node.update).toHaveBeenNthCalledWith(1, {
        where: { node_id: 'node-1' },
        data: { credit_balance: { increment: 90 } },
      });
      expect(mockPrisma.node.update).toHaveBeenNthCalledWith(2, {
        where: { node_id: 'node-2' },
        data: { reputation: { increment: 11 } },
      });
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

    it('should treat repeated cancellation as idempotent', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        status: 'cancelled',
        amount: 100,
      });

      const result = await service.cancelBounty('b-1', 'node-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should return the already-cancelled bounty when another worker won the race', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'open',
          amount: 100,
          title: 'Test',
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'cancelled',
          amount: 100,
          title: 'Test',
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.cancelBounty('b-1', 'node-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should release accepted bid escrow when cancelling a claimed bounty', async () => {
      mockPrisma.bounty.findUnique
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'claimed',
          amount: 100,
          title: 'Test',
          bids: [
            { bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 11, status: 'accepted' },
          ],
        })
        .mockResolvedValueOnce({
          bounty_id: 'b-1',
          creator_id: 'node-1',
          status: 'cancelled',
          amount: 100,
          title: 'Test',
          bids: [
            { bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 11, status: 'accepted' },
          ],
        });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 400,
      });
      mockPrisma.node.update
        .mockResolvedValueOnce({ credit_balance: 490 })
        .mockResolvedValueOnce({ reputation: 108 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.cancelBounty('b-1', 'node-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.node.update).toHaveBeenNthCalledWith(2, {
        where: { node_id: 'node-2' },
        data: { reputation: { increment: 11 } },
      });
    });
  });

  describe('expireBounties', () => {
    it('should expire past-deadline open bounties, refund credits, and release pending bid escrow', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([
        { bounty_id: 'b-1', creator_id: 'node-1', amount: 100, title: 'Test', deadline: new Date('2020-01-01T00:00:00.000Z') },
      ]);
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        amount: 100,
        title: 'Test',
        status: 'open',
        deadline: new Date('2020-01-01T00:00:00.000Z'),
        bids: [
          { bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80, reputation_escrow: 11, status: 'pending' },
        ],
      });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 400,
      });
      mockPrisma.node.update
        .mockResolvedValueOnce({ credit_balance: 500 })
        .mockResolvedValueOnce({ reputation: 108 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.expireBounties();
      expect(result.expired_count).toBe(1);
      expect(mockPrisma.node.update).toHaveBeenNthCalledWith(2, {
        where: { node_id: 'node-2' },
        data: { reputation: { increment: 11 } },
      });
    });

    it('should return 0 if no bounties to expire', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([]);

      const result = await service.expireBounties();
      expect(result.expired_count).toBe(0);
    });

    it('should skip duplicate expiry work when the bounty is already closed', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([
        { bounty_id: 'b-1', creator_id: 'node-1', amount: 100, title: 'Test', deadline: new Date('2020-01-01T00:00:00.000Z') },
      ]);
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        amount: 100,
        title: 'Test',
        status: 'expired',
        deadline: new Date('2020-01-01T00:00:00.000Z'),
      });

      const result = await service.expireBounties();

      expect(result.expired_count).toBe(0);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should mark the bounty expired even when the creator record is missing', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([
        { bounty_id: 'b-1', creator_id: 'node-1', amount: 100, title: 'Test', deadline: new Date('2020-01-01T00:00:00.000Z') },
      ]);
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        amount: 100,
        title: 'Test',
        status: 'open',
        deadline: new Date('2020-01-01T00:00:00.000Z'),
      });
      mockPrisma.bounty.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.node.findUnique.mockResolvedValue(null);

      const result = await service.expireBounties();

      expect(result.expired_count).toBe(1);
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('getBounty', () => {
    it('should return full bounty details to the creator', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        bids: [{ bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80 }],
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
      });

      const result = await service.getBounty('b-1', 'node-1');
      expect(result.bounty_id).toBe('b-1');
      expect(result.bids).toHaveLength(1);
      expect(result.deliverable).toEqual({ worker_id: 'node-2', review_status: 'pending' });
    });

    it('should redact other bids and deliverable details for non-creators', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
        bids: [
          { bid_id: 'bid-1', bidder_id: 'node-2', proposed_amount: 80 },
          { bid_id: 'bid-2', bidder_id: 'node-3', proposed_amount: 70 },
        ],
        deliverable: { worker_id: 'node-2', review_status: 'pending' },
      });

      const result = await service.getBounty('b-1', 'node-3');

      expect(result.bids).toEqual([
        expect.objectContaining({
          bid_id: 'bid-2',
          bidder_id: 'node-3',
          proposed_amount: 70,
          reputation_escrow: 7,
        }),
      ]);
      expect(result.deliverable).toBeNull();
    });

    it('should throw NotFoundError for missing bounty', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue(null);

      await expect(service.getBounty('nonexistent', 'node-1')).rejects.toThrow('Bounty not found');
    });
  });

  describe('listBidsForBounty', () => {
    it('should return all bids to the bounty creator', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
      });
      mockPrisma.bountyBid.findMany.mockResolvedValue([
        { bid_id: 'bid-1', bidder_id: 'node-2', bounty_id: 'b-1', proposed_amount: 80, estimated_time: '2d', approach: 'A', status: 'pending', submitted_at: new Date().toISOString() },
        { bid_id: 'bid-2', bidder_id: 'node-3', bounty_id: 'b-1', proposed_amount: 70, estimated_time: '1d', approach: 'B', status: 'pending', submitted_at: new Date().toISOString() },
      ]);

      const result = await service.listBidsForBounty('b-1', 'node-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.bountyBid.findMany).toHaveBeenCalledWith({
        where: { bounty_id: 'b-1' },
        orderBy: { submitted_at: 'desc' },
      });
    });

    it('should only return the requester bids to non-creators', async () => {
      mockPrisma.bounty.findUnique.mockResolvedValue({
        bounty_id: 'b-1',
        creator_id: 'node-1',
      });
      mockPrisma.bountyBid.findMany.mockResolvedValue([
        { bid_id: 'bid-2', bidder_id: 'node-3', bounty_id: 'b-1', proposed_amount: 70, estimated_time: '1d', approach: 'B', status: 'pending', submitted_at: new Date().toISOString() },
      ]);

      const result = await service.listBidsForBounty('b-1', 'node-3');

      expect(result).toHaveLength(1);
      expect(result[0]?.bidder_id).toBe('node-3');
      expect(mockPrisma.bountyBid.findMany).toHaveBeenCalledWith({
        where: { bounty_id: 'b-1', bidder_id: 'node-3' },
        orderBy: { submitted_at: 'desc' },
      });
    });
  });

  describe('listBounties', () => {
    it('should return paginated bounties with deliverables redacted', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([{ bounty_id: 'b-1', deliverable: { secret: true } }]);
      mockPrisma.bounty.count.mockResolvedValue(1);

      const result = await service.listBounties({ limit: 10, offset: 0 });
      expect(result.bounties).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.bounties[0]?.deliverable).toBeNull();
    });

    it('should filter by creator_id when provided', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([]);
      mockPrisma.bounty.count.mockResolvedValue(0);

      await service.listBounties({ creator_id: 'node-2', limit: 5, offset: 1 });

      expect(mockPrisma.bounty.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { creator_id: 'node-2' },
        take: 5,
        skip: 1,
      }));
      expect(mockPrisma.bounty.count).toHaveBeenCalledWith({
        where: { creator_id: 'node-2' },
      });
    });

    it('should sort by reward at the query layer when requested', async () => {
      mockPrisma.bounty.findMany.mockResolvedValue([]);
      mockPrisma.bounty.count.mockResolvedValue(0);

      await service.listBounties({ status: 'open', sort: 'reward_desc', limit: 20, offset: 40 });

      expect(mockPrisma.bounty.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { status: 'open' },
        orderBy: [{ amount: 'desc' }, { created_at: 'desc' }, { bounty_id: 'desc' }],
        take: 20,
        skip: 40,
      }));
    });
  });
});

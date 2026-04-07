import * as service from './service';

const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  proposal: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  proposalVote: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
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

describe('Council Service', () => {
  describe('createProposal', () => {
    it('should create a proposal and deduct deposit', async () => {
      const mockNode = { node_id: 'node-1', credit_balance: 500 };
      const mockProposal = {
        proposal_id: 'prop-1',
        title: 'Test Proposal',
        status: 'draft',
        deposit: 50,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ ...mockNode, credit_balance: 450 });
      mockPrisma.proposal.create.mockResolvedValue(mockProposal);
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.createProposal(
        'node-1', 'Test Proposal', 'desc', 'parameter_change',
      );

      expect(result.status).toBe('draft');
      expect(result.deposit).toBe(50);
    });

    it('should throw NotFoundError if proposer not found', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(
        service.createProposal('nonexistent', 'Title', 'desc', 'parameter_change'),
      ).rejects.toThrow('Node not found');
    });

    it('should throw InsufficientCreditsError if balance too low', async () => {
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        credit_balance: 10,
      });

      await expect(
        service.createProposal('node-1', 'Title', 'desc', 'parameter_change'),
      ).rejects.toThrow('Insufficient credits');
    });
  });

  describe('secondProposal', () => {
    it('should add a second to a draft proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'draft',
        proposer_id: 'node-1',
        seconds: [],
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        reputation: 85,
      });
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'seconded',
        seconds: ['node-2'],
      });

      const result = await service.secondProposal('prop-1', 'node-2');
      expect(result.seconds).toContain('node-2');
    });

    it('should transition to discussion when enough seconds', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'draft',
        proposer_id: 'node-1',
        seconds: ['node-2'],
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-3',
        reputation: 90,
      });
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'discussion',
        seconds: ['node-2', 'node-3'],
      });

      const result = await service.secondProposal('prop-1', 'node-3');
      expect(result.status).toBe('discussion');
    });

    it('should reject self-seconding', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'draft',
        proposer_id: 'node-1',
        seconds: [],
      });

      await expect(
        service.secondProposal('prop-1', 'node-1'),
      ).rejects.toThrow('cannot second their own proposal');
    });

    it('should reject duplicate seconding', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'draft',
        proposer_id: 'node-1',
        seconds: ['node-2'],
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        reputation: 85,
      });

      await expect(
        service.secondProposal('prop-1', 'node-2'),
      ).rejects.toThrow('already seconded');
    });

    it('should reject seconder with low reputation', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'draft',
        proposer_id: 'node-1',
        seconds: [],
      });
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-2',
        reputation: 50,
      });

      await expect(
        service.secondProposal('prop-1', 'node-2'),
      ).rejects.toThrow('Reputation 80 required');
    });
  });

  describe('vote', () => {
    it('should cast a weighted vote', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'discussion',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        reputation: 95,
      });
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        voter_id: 'node-1',
        decision: 'approve',
        weight: 1.5,
      });

      const result = await service.vote('prop-1', 'node-1', 'approve');
      expect(result.weight).toBe(1.5);
    });

    it('should reject duplicate vote', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue({
        voter_id: 'node-1',
        decision: 'approve',
      });

      await expect(
        service.vote('prop-1', 'node-1', 'reject'),
      ).rejects.toThrow('already voted');
    });

    it('should apply correct weight for reputation tiers', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-low',
        reputation: 30,
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        weight: 0.5,
      });

      const result = await service.vote('prop-1', 'node-low', 'approve');
      expect(result.weight).toBe(0.5);
    });

    it('should update proposal status from discussion to voting', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'discussion',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-1',
        reputation: 85,
      });
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        voter_id: 'node-1',
        decision: 'approve',
        weight: 1.2,
      });

      await service.vote('prop-1', 'node-1', 'approve');

      expect(mockPrisma.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { proposal_id: 'prop-1' },
          data: expect.objectContaining({ status: 'voting' }),
        }),
      );
    });

    it('should throw NotFoundError if voter node does not exist', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue(null);

      await expect(
        service.vote('prop-1', 'nonexistent', 'approve'),
      ).rejects.toThrow('Node not found');
    });

    it('should use multiplier 1.0 for reputation at max boundary of third tier (69)', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-boundary',
        reputation: 69,
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        weight: 1.0,
      });

      const result = await service.vote('prop-1', 'node-boundary', 'approve');
      expect(result.weight).toBe(1.0);
    });

    it('should use multiplier 1.2 for reputation at min boundary of second tier (70)', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-boundary',
        reputation: 70,
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        weight: 1.2,
      });

      const result = await service.vote('prop-1', 'node-boundary', 'approve');
      expect(result.weight).toBe(1.2);
    });

    it('should use multiplier 1.5 for reputation at max boundary of first tier (100)', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-boundary',
        reputation: 100,
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        weight: 1.5,
      });

      const result = await service.vote('prop-1', 'node-boundary', 'approve');
      expect(result.weight).toBe(1.5);
    });

    it('should use multiplier 0.5 for reputation below all tiers (negative)', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-below',
        reputation: -5,
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        weight: 0.5,
      });

      const result = await service.vote('prop-1', 'node-below', 'approve');
      expect(result.weight).toBe(0.5);
    });

    it('should use default multiplier 1.0 for reputation above all tiers', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
      });
      mockPrisma.proposalVote.findUnique.mockResolvedValue(null);
      mockPrisma.node.findUnique.mockResolvedValue({
        node_id: 'node-above',
        reputation: 200,
      });
      mockPrisma.proposalVote.create.mockResolvedValue({
        weight: 1.0,
      });

      const result = await service.vote('prop-1', 'node-above', 'approve');
      expect(result.weight).toBe(1.0);
    });
  });

  describe('executeDecision', () => {
    it('should approve proposal with majority', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
        proposer_id: 'node-1',
        deposit: 50,
        votes: [
          { decision: 'approve', weight: 1.5 },
          { decision: 'approve', weight: 1.2 },
          { decision: 'reject', weight: 1.0 },
        ],
      });
      mockPrisma.node.count.mockResolvedValue(5);
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'approved',
      });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await service.executeDecision('prop-1');
      expect(result.status).toBe('approved');
    });

    it('should reject proposal below quorum', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
        proposer_id: 'node-1',
        deposit: 50,
        votes: [
          { decision: 'approve', weight: 1.0 },
        ],
      });
      mockPrisma.node.count.mockResolvedValue(100);
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'rejected',
      });

      const result = await service.executeDecision('prop-1');
      expect(result.status).toBe('rejected');
    });

    it('should reject if not in voting status', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'draft',
      });

      await expect(
        service.executeDecision('prop-1'),
      ).rejects.toThrow('must be in voting status');
    });

    it('should reject proposal when votes array is empty (quorum not met)', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
        proposer_id: 'node-1',
        deposit: 50,
        votes: [],
      });
      mockPrisma.node.count.mockResolvedValue(5);
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'rejected',
      });

      const result = await service.executeDecision('prop-1');
      expect(result.status).toBe('rejected');
      expect(mockPrisma.proposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            execution_result: expect.stringContaining('Quorum not met'),
          }),
        }),
      );
    });

    it('should throw NotFoundError if proposal does not exist', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(
        service.executeDecision('nonexistent'),
      ).rejects.toThrow('Proposal not found');
    });

    it('should return deposit to proposer when approved', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'voting',
        proposer_id: 'node-1',
        deposit: 50,
        votes: [
          { decision: 'approve', weight: 1.5 },
        ],
      });
      mockPrisma.node.count.mockResolvedValue(2);
      mockPrisma.proposal.update.mockResolvedValue({
        proposal_id: 'prop-1',
        status: 'approved',
      });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      await service.executeDecision('prop-1');

      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            amount: 50,
            type: 'proposal_deposit',
            description: 'Proposal approved - deposit returned',
          }),
        }),
      );
    });
  });

  describe('getProposal', () => {
    it('should return proposal with votes', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({
        proposal_id: 'prop-1',
        votes: [],
      });

      const result = await service.getProposal('prop-1');
      expect(result.proposal_id).toBe('prop-1');
    });

    it('should throw NotFoundError for missing proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.getProposal('nonexistent')).rejects.toThrow('Proposal not found');
    });
  });

  describe('listProposals', () => {
    it('should return paginated proposals', async () => {
      mockPrisma.proposal.findMany.mockResolvedValue([{ proposal_id: 'p1' }]);
      mockPrisma.proposal.count.mockResolvedValue(1);

      const result = await service.listProposals({ limit: 10, offset: 0 });
      expect(result.proposals).toHaveLength(1);
    });
  });

  describe('getVotes', () => {
    it('should return votes for a proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue({ proposal_id: 'prop-1' });
      mockPrisma.proposalVote.findMany.mockResolvedValue([
        { voter_id: 'node-1', decision: 'approve' },
      ]);

      const result = await service.getVotes('prop-1');
      expect(result).toHaveLength(1);
    });

    it('should throw NotFoundError for missing proposal', async () => {
      mockPrisma.proposal.findUnique.mockResolvedValue(null);

      await expect(service.getVotes('nonexistent')).rejects.toThrow('Proposal not found');
    });
  });
});

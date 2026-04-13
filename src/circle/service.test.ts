import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  createCircle,
  joinCircle,
  startRound,
  submitAsset,
  vote,
  advanceRound,
  completeCircle,
} from './service';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  InsufficientCreditsError,
  ConflictError,
} from '../shared/errors';
import {
  CIRCLE_ENTRY_FEE,
  CIRCLE_MIN_PARTICIPANTS,
  CIRCLE_MAX_PARTICIPANTS,
  CIRCLE_WINNER_PRIZE,
  CIRCLE_ELIMINATION_RATE,
  CIRCLE_MAX_ROUNDS,
} from '../shared/constants';

const mockPrisma = {
  $transaction: jest.fn(),
  asset: {
    findUnique: jest.fn(),
  },
  node: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  circle: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  creditTransaction: {
    create: jest.fn(),
  },
} as any;

const mockCircleRecord = {
  circle_id: 'circle-1',
  name: 'Test Circle',
  description: 'A test circle',
  theme: 'innovation',
  status: 'active',
  creator_id: 'creator-1',
  participant_count: 3,
  members: ['creator-1', 'node-1', 'node-2'],
  rounds: [],
  rounds_completed: 0,
  outcomes: [],
  entry_fee: CIRCLE_ENTRY_FEE,
  prize_pool: CIRCLE_ENTRY_FEE * 3,
  created_at: new Date('2026-01-01'),
};

const mockNode = {
  node_id: 'node-1',
  credit_balance: 1000,
};

describe('Circle Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma));
    mockPrisma.asset.findUnique.mockResolvedValue({ author_id: 'node-1' });
    mockPrisma.circle.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.node.update.mockResolvedValue({ credit_balance: mockNode.credit_balance });
  });

  describe('createCircle', () => {
    it('should create a circle successfully', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ credit_balance: mockNode.credit_balance - CIRCLE_ENTRY_FEE });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.circle.create.mockResolvedValue(mockCircleRecord);

      const result = await createCircle('node-1', 'Test Circle', 'A test circle', 'innovation');

      expect(result.circle_id).toBe('circle-1');
      expect(result.name).toBe('Test Circle');
      expect(result.theme).toBe('innovation');
      expect(mockPrisma.node.findFirst).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
      });
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'node-1' },
        data: { credit_balance: { decrement: CIRCLE_ENTRY_FEE } },
        select: { credit_balance: true },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'node-1',
            amount: -CIRCLE_ENTRY_FEE,
            type: 'circle_entry',
          }),
        }),
      );
    });

    it('should throw ValidationError for empty name', async () => {
      await expect(createCircle('node-1', '', 'desc', 'theme'))
        .rejects.toThrow(ValidationError);
      await expect(createCircle('node-1', '   ', 'desc', 'theme'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent node', async () => {
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(createCircle('unknown', 'Name', 'desc', 'theme'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientCreditsError when balance too low', async () => {
      mockPrisma.node.findFirst.mockResolvedValue({
        ...mockNode,
        credit_balance: 10,
      });

      await expect(createCircle('node-1', 'Name', 'desc', 'theme'))
        .rejects.toThrow(InsufficientCreditsError);
    });
  });

  describe('joinCircle', () => {
    it('should join a circle successfully', async () => {
      const circleRecord = {
        ...mockCircleRecord,
        participant_count: 1,
        members: ['creator-1'],
        prize_pool: CIRCLE_ENTRY_FEE,
        creator_id: 'creator-1',
      };

      mockPrisma.circle.findUnique.mockResolvedValue(circleRecord);
      mockPrisma.node.findFirst.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({ credit_balance: mockNode.credit_balance - CIRCLE_ENTRY_FEE });
      mockPrisma.creditTransaction.create.mockResolvedValue({});
      mockPrisma.circle.update.mockResolvedValue({
        ...circleRecord,
        participant_count: 2,
        prize_pool: CIRCLE_ENTRY_FEE * 2,
      });

      const result = await joinCircle('circle-1', 'node-1');

      expect(mockPrisma.circle.update).toHaveBeenCalledWith({
        where: { circle_id: 'circle-1' },
        data: {
          participant_count: 2,
          members: ['creator-1', 'node-1'],
          prize_pool: CIRCLE_ENTRY_FEE * 2,
        },
      });
    });

    it('should throw NotFoundError for non-existent circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(null);

      await expect(joinCircle('unknown', 'node-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if circle not active', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        status: 'completed',
      });

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if rounds already started', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{ round_number: 1, status: 'ongoing' }],
      });

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent node', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(mockCircleRecord);
      mockPrisma.node.findFirst.mockResolvedValue(null);

      await expect(joinCircle('circle-1', 'unknown'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw InsufficientCreditsError when node balance too low', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: 1,
        members: ['creator-1'],
      });
      mockPrisma.node.findFirst.mockResolvedValue({
        ...mockNode,
        credit_balance: 5,
      });

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(InsufficientCreditsError);
    });

    it('should throw ValidationError when max participants reached', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: CIRCLE_MAX_PARTICIPANTS,
        members: Array.from({ length: CIRCLE_MAX_PARTICIPANTS }, (_, index) => `node-${index}`),
      });
      mockPrisma.node.findFirst.mockResolvedValue(mockNode);

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when creator tries to join again', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        creator_id: 'node-1',
      });
      mockPrisma.node.findFirst.mockResolvedValue(mockNode);

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when node already joined the circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: 2,
        members: ['creator-1', 'node-1'],
      });
      mockPrisma.node.findFirst.mockResolvedValue(mockNode);

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when legacy membership backfill is incomplete', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: 3,
        members: ['creator-1'],
      });

      await expect(joinCircle('circle-1', 'node-1'))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('startRound', () => {
    it('should start a new round successfully', async () => {
      const circleWithParticipants = {
        ...mockCircleRecord,
        participant_count: CIRCLE_MIN_PARTICIPANTS,
        rounds: [],
        rounds_completed: 0,
      };

      mockPrisma.circle.findUnique.mockResolvedValue(circleWithParticipants);
      mockPrisma.circle.update.mockResolvedValue({
        ...circleWithParticipants,
        rounds: [{ round_number: 1, status: 'ongoing' }],
      });

      const result = await startRound('circle-1', 'creator-1');

      expect(mockPrisma.circle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { circle_id: 'circle-1' },
        }),
      );

      const updateCall = mockPrisma.circle.update.mock.calls[0]![0];
      const updatedRounds = updateCall.data.rounds as Array<{ round_number: number; status: string }>;
      expect(updatedRounds).toHaveLength(1);
      expect(updatedRounds[0]!.round_number).toBe(1);
      expect(updatedRounds[0]!.status).toBe('ongoing');
    });

    it('should throw NotFoundError for non-existent circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(null);

      await expect(startRound('unknown', 'creator-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when not enough participants', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: 1,
      });

      await expect(startRound('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when max rounds reached', async () => {
      const maxRounds = Array.from({ length: CIRCLE_MAX_ROUNDS }, (_, i) => ({
        round_number: i + 1,
        status: 'completed',
      }));

      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: CIRCLE_MIN_PARTICIPANTS,
        rounds: maxRounds,
      });

      await expect(startRound('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when another round is still ongoing', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: CIRCLE_MIN_PARTICIPANTS,
        rounds: [{
          round_number: 1,
          status: 'ongoing',
          submissions: [],
          votes: [],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      });

      await expect(startRound('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when legacy membership backfill is incomplete', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: CIRCLE_MIN_PARTICIPANTS,
        members: ['creator-1'],
      });

      await expect(startRound('circle-1', 'creator-1'))
        .rejects.toThrow(ConflictError);
    });

    it('should throw ForbiddenError when a non-creator starts a round', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        participant_count: CIRCLE_MIN_PARTICIPANTS,
      });

      await expect(startRound('circle-1', 'node-2'))
        .rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError when the circle is already completed', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        status: 'completed',
        participant_count: CIRCLE_MIN_PARTICIPANTS,
      });

      await expect(startRound('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should start second round after first round completed', async () => {
      const circleWithOneRound = {
        ...mockCircleRecord,
        participant_count: CIRCLE_MIN_PARTICIPANTS,
        rounds: [{ round_number: 1, status: 'completed', submissions: [], votes: [], eliminated: [] }],
        rounds_completed: 1,
      };

      mockPrisma.circle.findUnique.mockResolvedValue(circleWithOneRound);
      mockPrisma.circle.update.mockResolvedValue({
        ...circleWithOneRound,
        rounds: [
          ...circleWithOneRound.rounds,
          { round_number: 2, status: 'ongoing' },
        ],
      });

      const result = await startRound('circle-1', 'creator-1');

      expect(mockPrisma.circle.update).toHaveBeenCalled();
    });
  });

  describe('submitAsset', () => {
    const circleWithOngoingRound = {
      ...mockCircleRecord,
      rounds: [{
        round_number: 1,
        status: 'ongoing',
        submissions: [],
        votes: [],
        eliminated: [],
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }],
    };

    it('should submit an asset successfully', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(circleWithOngoingRound);
      mockPrisma.circle.update.mockResolvedValue({
        ...circleWithOngoingRound,
        rounds: [{
          ...circleWithOngoingRound.rounds[0],
          submissions: [{ node_id: 'node-1', asset_id: 'asset-1' }],
        }],
      });

      const result = await submitAsset('circle-1', 1, 'node-1', 'asset-1');

      expect(mockPrisma.circle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { circle_id: 'circle-1' },
        }),
      );
    });

    it('should throw NotFoundError for non-existent circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(null);

      await expect(submitAsset('unknown', 1, 'node-1', 'asset-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent round', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [],
      });

      await expect(submitAsset('circle-1', 99, 'node-1', 'asset-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if round not ongoing', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'completed',
          submissions: [],
          votes: [],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      });

      await expect(submitAsset('circle-1', 1, 'node-1', 'asset-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when legacy membership backfill is incomplete', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...circleWithOngoingRound,
        participant_count: 3,
        members: ['creator-1'],
      });

      await expect(submitAsset('circle-1', 1, 'node-1', 'asset-1'))
        .rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError if already submitted', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'ongoing',
          submissions: [{ node_id: 'node-1', asset_id: 'asset-old', submitted_at: new Date().toISOString() }],
          votes: [],
          eliminated: [],
          deadline: new Date(Date.now() + 86400000).toISOString(),
        }],
      });

      await expect(submitAsset('circle-1', 1, 'node-1', 'asset-new'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ForbiddenError when submitting an asset owned by another node', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(circleWithOngoingRound);
      mockPrisma.asset.findUnique.mockResolvedValue({ author_id: 'node-2' });

      await expect(submitAsset('circle-1', 1, 'node-1', 'asset-1'))
        .rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when a non-member submits to the circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...circleWithOngoingRound,
        participant_count: 2,
        members: ['creator-1', 'node-1'],
      });
      mockPrisma.asset.findUnique.mockResolvedValue({ author_id: 'node-3' });

      await expect(submitAsset('circle-1', 1, 'node-3', 'asset-3'))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('vote', () => {
    const circleForVoting = {
      ...mockCircleRecord,
      rounds: [{
        round_number: 1,
        status: 'ongoing',
        submissions: [
          { node_id: 'node-1', asset_id: 'asset-1', submitted_at: new Date().toISOString() },
          { node_id: 'node-2', asset_id: 'asset-2', submitted_at: new Date().toISOString() },
        ],
        votes: [],
        eliminated: [],
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }],
    };

    it('should cast a vote successfully', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(circleForVoting);
      mockPrisma.circle.update.mockResolvedValue(circleForVoting);

      const result = await vote('circle-1', 1, 'node-1', 'node-2', 8);

      expect(mockPrisma.circle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { circle_id: 'circle-1' },
        }),
      );
    });

    it('should throw ValidationError for score below 1', async () => {
      await expect(vote('circle-1', 1, 'voter-1', 'target-1', 0))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for score above 10', async () => {
      await expect(vote('circle-1', 1, 'voter-1', 'target-1', 11))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when voting for self', async () => {
      await expect(vote('circle-1', 1, 'node-1', 'node-1', 5))
        .rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(null);

      await expect(vote('unknown', 1, 'node-1', 'node-2', 5))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent round', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [],
      });

      await expect(vote('circle-1', 99, 'node-1', 'node-2', 5))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if already voted for target', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'ongoing',
          submissions: [
            { node_id: 'node-1', asset_id: 'asset-1', submitted_at: new Date().toISOString() },
            { node_id: 'node-2', asset_id: 'asset-2', submitted_at: new Date().toISOString() },
          ],
          votes: [{
            voter_id: 'node-1',
            target_id: 'node-2',
            score: 7,
            cast_at: new Date().toISOString(),
          }],
          eliminated: [],
          deadline: new Date(Date.now() + 86400000).toISOString(),
        }],
      });

      await expect(vote('circle-1', 1, 'node-1', 'node-2', 8))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when the circle is completed', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...circleForVoting,
        status: 'completed',
      });

      await expect(vote('circle-1', 1, 'node-1', 'node-2', 8))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when the round is not ongoing', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'completed',
          submissions: [
            { node_id: 'node-1', asset_id: 'asset-1', submitted_at: new Date().toISOString() },
            { node_id: 'node-2', asset_id: 'asset-2', submitted_at: new Date().toISOString() },
          ],
          votes: [],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      });

      await expect(vote('circle-1', 1, 'node-1', 'node-2', 8))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when legacy membership backfill is incomplete', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...circleForVoting,
        participant_count: 3,
        members: ['creator-1'],
      });

      await expect(vote('circle-1', 1, 'node-1', 'node-2', 8))
        .rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError when voting for a node without a submission', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(circleForVoting);

      await expect(vote('circle-1', 1, 'node-1', 'node-3', 8))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ForbiddenError when a non-member votes in the round', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...circleForVoting,
        members: ['creator-1', 'node-1', 'node-2'],
      });

      await expect(vote('circle-1', 1, 'node-3', 'node-2', 8))
        .rejects.toThrow(ForbiddenError);
    });

    it('should accept boundary score of 1', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(circleForVoting);
      mockPrisma.circle.update.mockResolvedValue(circleForVoting);

      await expect(vote('circle-1', 1, 'node-1', 'node-2', 1))
        .resolves.toBeDefined();
    });

    it('should accept boundary score of 10', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(circleForVoting);
      mockPrisma.circle.update.mockResolvedValue(circleForVoting);

      await expect(vote('circle-1', 1, 'node-1', 'node-2', 10))
        .resolves.toBeDefined();
    });
  });

  describe('advanceRound', () => {
    it('should advance round and eliminate lowest scorers', async () => {
      const circleWithVotes = {
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'ongoing',
          submissions: [],
          votes: [
            { voter_id: 'v1', target_id: 'p1', score: 9, cast_at: new Date().toISOString() },
            { voter_id: 'v2', target_id: 'p1', score: 8, cast_at: new Date().toISOString() },
            { voter_id: 'v1', target_id: 'p2', score: 3, cast_at: new Date().toISOString() },
            { voter_id: 'v2', target_id: 'p2', score: 2, cast_at: new Date().toISOString() },
            { voter_id: 'v1', target_id: 'p3', score: 5, cast_at: new Date().toISOString() },
            { voter_id: 'v2', target_id: 'p3', score: 4, cast_at: new Date().toISOString() },
          ],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
        rounds_completed: 0,
      };

      mockPrisma.circle.findUnique.mockResolvedValue(circleWithVotes);
      mockPrisma.circle.update.mockResolvedValue({
        ...circleWithVotes,
        rounds: [{ ...circleWithVotes.rounds[0], status: 'completed' }],
        rounds_completed: 1,
      });

      const result = await advanceRound('circle-1', 'creator-1');

      expect(mockPrisma.circle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { circle_id: 'circle-1' },
          data: expect.objectContaining({
            rounds_completed: 1,
          }),
        }),
      );

      const updateCall = mockPrisma.circle.update.mock.calls[0]![0];
      const updatedRounds = updateCall.data.rounds as Array<{ eliminated: string[]; status: string }>;
      expect(updatedRounds[0]!.status).toBe('completed');
      expect(updatedRounds[0]!.eliminated).toContain('p2');
    });

    it('should throw NotFoundError for non-existent circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(null);

      await expect(advanceRound('unknown', 'creator-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when no rounds exist', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [],
      });

      await expect(advanceRound('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when no ongoing round', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'completed',
          submissions: [],
          votes: [],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      });

      await expect(advanceRound('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ForbiddenError when a non-creator advances a round', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(mockCircleRecord);

      await expect(advanceRound('circle-1', 'node-2'))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe('completeCircle', () => {
    it('should complete circle with winner prize', async () => {
      const completedRoundCircle = {
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'completed',
          submissions: [],
          votes: [
            { voter_id: 'v1', target_id: 'winner-1', score: 10, cast_at: new Date().toISOString() },
            { voter_id: 'v2', target_id: 'winner-1', score: 9, cast_at: new Date().toISOString() },
            { voter_id: 'v1', target_id: 'loser-1', score: 2, cast_at: new Date().toISOString() },
          ],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      };

      mockPrisma.circle.findUnique.mockResolvedValue(completedRoundCircle);
      mockPrisma.node.update.mockResolvedValue({ credit_balance: 500 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await completeCircle('circle-1', 'creator-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.node.update).toHaveBeenCalledWith({
        where: { node_id: 'winner-1' },
        data: { credit_balance: { increment: CIRCLE_WINNER_PRIZE } },
        select: { credit_balance: true },
      });
      expect(mockPrisma.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            node_id: 'winner-1',
            amount: CIRCLE_WINNER_PRIZE,
            type: 'circle_prize',
            balance_after: 500,
          }),
        }),
      );
      expect(mockPrisma.circle.updateMany).toHaveBeenCalledWith({
        where: {
          circle_id: 'circle-1',
          status: { not: 'completed' },
        },
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should throw NotFoundError for non-existent circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(null);

      await expect(completeCircle('unknown', 'creator-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when no rounds played', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [],
      });

      await expect(completeCircle('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when the final round is still ongoing', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'ongoing',
          submissions: [],
          votes: [],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      });

      await expect(completeCircle('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle circle with no votes (no outcomes)', async () => {
      const circleNoVotes = {
        ...mockCircleRecord,
        rounds: [{
          round_number: 1,
          status: 'completed',
          submissions: [],
          votes: [],
          eliminated: [],
          deadline: new Date().toISOString(),
        }],
      };

      mockPrisma.circle.findUnique.mockResolvedValue(circleNoVotes);

      const result = await completeCircle('circle-1', 'creator-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.node.update).not.toHaveBeenCalled();
      expect(mockPrisma.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('should aggregate scores across multiple rounds', async () => {
      const multiRoundCircle = {
        ...mockCircleRecord,
        rounds: [
          {
            round_number: 1,
            status: 'completed',
            submissions: [],
            votes: [
              { voter_id: 'v1', target_id: 'p1', score: 5, cast_at: new Date().toISOString() },
            ],
            eliminated: [],
            deadline: new Date().toISOString(),
          },
          {
            round_number: 2,
            status: 'completed',
            submissions: [],
            votes: [
              { voter_id: 'v1', target_id: 'p1', score: 5, cast_at: new Date().toISOString() },
            ],
            eliminated: [],
            deadline: new Date().toISOString(),
          },
        ],
      };

      mockPrisma.circle.findUnique.mockResolvedValue(multiRoundCircle);
      mockPrisma.node.update.mockResolvedValue({ credit_balance: 100 });
      mockPrisma.creditTransaction.create.mockResolvedValue({});

      const result = await completeCircle('circle-1', 'creator-1');

      const updateCall = mockPrisma.circle.updateMany.mock.calls[0]![0];
      const outcomes = updateCall.data.outcomes as Array<{ node_id: string; total_score: number }>;
      expect(outcomes[0]!.total_score).toBe(10);
    });

    it('should throw ForbiddenError when a non-creator completes a circle', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue(mockCircleRecord);

      await expect(completeCircle('circle-1', 'node-2'))
        .rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError when the circle is already completed', async () => {
      mockPrisma.circle.findUnique.mockResolvedValue({
        ...mockCircleRecord,
        status: 'completed',
      });

      await expect(completeCircle('circle-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
      expect(mockPrisma.circle.updateMany).not.toHaveBeenCalled();
    });
  });
});

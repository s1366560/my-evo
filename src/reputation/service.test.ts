import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  getScore,
  addPoints,
  getTier,
  getHistory,
  getLeaderboard,
} from './service';
import { NotFoundError, ValidationError } from '../shared/errors';
import { REPUTATION_EVENTS, MAX_REPUTATION, MIN_REPUTATION } from '../shared/constants';

// Mock PrismaClient
const mockPrisma = {
  node: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  reputationEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
} as any;

describe('Reputation Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTier', () => {
    it('should return newcomer for score 0-19', () => {
      expect(getTier(0)).toBe('newcomer');
      expect(getTier(10)).toBe('newcomer');
      expect(getTier(19)).toBe('newcomer');
    });

    it('should return contributor for score 20-39', () => {
      expect(getTier(20)).toBe('contributor');
      expect(getTier(30)).toBe('contributor');
      expect(getTier(39)).toBe('contributor');
    });

    it('should return established for score 40-59', () => {
      expect(getTier(40)).toBe('established');
      expect(getTier(50)).toBe('established');
      expect(getTier(59)).toBe('established');
    });

    it('should return respected for score 60-79', () => {
      expect(getTier(60)).toBe('respected');
      expect(getTier(70)).toBe('respected');
      expect(getTier(79)).toBe('respected');
    });

    it('should return authority for score 80-89', () => {
      expect(getTier(80)).toBe('authority');
      expect(getTier(85)).toBe('authority');
      expect(getTier(89)).toBe('authority');
    });

    it('should return legend for score 90-100', () => {
      expect(getTier(90)).toBe('legend');
      expect(getTier(95)).toBe('legend');
      expect(getTier(100)).toBe('legend');
    });
  });

  describe('getScore', () => {
    it('should return reputation score for existing node', async () => {
      const mockNode = {
        node_id: 'node-1',
        reputation: 65,
      };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.reputationEvent.findMany.mockResolvedValue([
        { event_type: 'publish', delta: 2, reason: 'Published gene', timestamp: new Date() },
      ]);

      const result = await getScore('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.score).toBe(65);
      expect(result.tier).toBe('respected');
      expect(result.history).toHaveLength(1);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(getScore('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should return correct tier for initial reputation', async () => {
      const mockNode = { node_id: 'node-1', reputation: 50 };
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

      const result = await getScore('node-1');
      expect(result.tier).toBe('established');
    });
  });

  describe('addPoints', () => {
    it('should add reputation for publish event', async () => {
      const mockNode = { node_id: 'node-1', reputation: 50 };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

      const result = await addPoints('node-1', 'publish');

      expect(result.score).toBe(52);
      expect(mockPrisma.node.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { reputation: 52 },
        }),
      );
    });

    it('should add 50 for promoted event', async () => {
      const mockNode = { node_id: 'node-1', reputation: 50 };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

      const result = await addPoints('node-1', 'promoted');

      expect(result.score).toBe(100);
    });

    it('should subtract 100 for revoked event', async () => {
      const mockNode = { node_id: 'node-1', reputation: 50 };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

      const result = await addPoints('node-1', 'revoked');

      expect(result.score).toBe(0);
    });

    it('should clamp score to maximum 100', async () => {
      const mockNode = { node_id: 'node-1', reputation: 99 };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

      const result = await addPoints('node-1', 'promoted');

      expect(result.score).toBe(MAX_REPUTATION);
    });

    it('should clamp score to minimum 0', async () => {
      const mockNode = { node_id: 'node-1', reputation: 5 };

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.node.update.mockResolvedValue({});
      mockPrisma.reputationEvent.create.mockResolvedValue({});
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

      const result = await addPoints('node-1', 'revoked');

      expect(result.score).toBe(MIN_REPUTATION);
    });

    it('should throw ValidationError for unknown event type', async () => {
      await expect(addPoints('node-1', 'unknown_event')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(addPoints('unknown', 'publish')).rejects.toThrow(NotFoundError);
    });

    it('should handle all event types correctly', async () => {
      const eventTypes = Object.keys(REPUTATION_EVENTS);

      for (const eventType of eventTypes) {
        const mockNode = { node_id: 'node-1', reputation: 50 };
        mockPrisma.node.findUnique.mockResolvedValue(mockNode);
        mockPrisma.node.update.mockResolvedValue({});
        mockPrisma.reputationEvent.create.mockResolvedValue({});
        mockPrisma.reputationEvent.findMany.mockResolvedValue([]);

        const result = await addPoints('node-1', eventType);
        const expectedDelta = REPUTATION_EVENTS[eventType as keyof typeof REPUTATION_EVENTS];
        const expectedScore = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, 50 + expectedDelta));

        expect(result.score).toBe(expectedScore);
      }
    });
  });

  describe('getHistory', () => {
    it('should return paginated reputation history', async () => {
      const mockNode = { node_id: 'node-1', reputation: 50 };
      const mockEvents = [
        { event_type: 'publish', delta: 2, reason: 'Event: publish', timestamp: new Date() },
        { event_type: 'promoted', delta: 50, reason: 'Event: promoted', timestamp: new Date() },
      ];

      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.reputationEvent.findMany.mockResolvedValue(mockEvents);
      mockPrisma.reputationEvent.count.mockResolvedValue(2);

      const result = await getHistory('node-1', 20, 0);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should throw NotFoundError for unknown node', async () => {
      mockPrisma.node.findUnique.mockResolvedValue(null);
      await expect(getHistory('unknown')).rejects.toThrow(NotFoundError);
    });

    it('should respect limit and offset', async () => {
      const mockNode = { node_id: 'node-1', reputation: 50 };
      mockPrisma.node.findUnique.mockResolvedValue(mockNode);
      mockPrisma.reputationEvent.findMany.mockResolvedValue([]);
      mockPrisma.reputationEvent.count.mockResolvedValue(0);

      await getHistory('node-1', 5, 10);

      expect(mockPrisma.reputationEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        }),
      );
    });
  });

  describe('getLeaderboard', () => {
    it('should return nodes sorted by reputation descending', async () => {
      const mockNodes = [
        { node_id: 'node-1', reputation: 95 },
        { node_id: 'node-2', reputation: 80 },
        { node_id: 'node-3', reputation: 60 },
      ];

      mockPrisma.node.findMany.mockResolvedValue(mockNodes);

      const result = await getLeaderboard(10);

      expect(result).toHaveLength(3);
      expect(result[0]!.node_id).toBe('node-1');
      expect(result[0]!.score).toBe(95);
      expect(result[0]!.tier).toBe('legend');
      expect(result[1]!.tier).toBe('authority');
      expect(result[2]!.tier).toBe('respected');
    });

    it('should respect limit parameter', async () => {
      mockPrisma.node.findMany.mockResolvedValue([]);

      await getLeaderboard(5);

      expect(mockPrisma.node.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should respect offset parameter', async () => {
      mockPrisma.node.findMany.mockResolvedValue([]);

      await getLeaderboard(5, 12);

      expect(mockPrisma.node.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 12,
        }),
      );
    });

    it('should default to limit 20', async () => {
      mockPrisma.node.findMany.mockResolvedValue([]);

      await getLeaderboard();

      expect(mockPrisma.node.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        }),
      );
    });
  });

  describe('explicit prisma client', () => {
    it('uses the provided prisma client instead of the injected default', async () => {
      const explicitPrisma = {
        node: {
          findUnique: jest.fn().mockResolvedValue({
            node_id: 'node-explicit',
            reputation: 60,
          }),
        },
        reputationEvent: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaClient;

      await getScore('node-explicit', explicitPrisma);

      expect((explicitPrisma as unknown as {
        node: { findUnique: jest.Mock };
      }).node.findUnique).toHaveBeenCalledWith({
        where: { node_id: 'node-explicit' },
      });
      expect(mockPrisma.node.findUnique).not.toHaveBeenCalled();
    });
  });
});

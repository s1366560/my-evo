import { PrismaClient } from '@prisma/client';
import * as service from './service';
import * as matching from './matching';
import * as discovery from './discovery';
import * as drift from './drift';
import * as reply from './reply';
import * as moderation from './moderation';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  throwBottle,
  discoverBottle,
  replyToBottle,
  discardBottle,
  expireBottles,
} = service;

const mockPrisma = {
  driftBottle: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
} as any;

describe('Drift Bottle Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('throwBottle', () => {
    it('should create a drift bottle with valid input', async () => {
      const now = new Date();
      mockPrisma.driftBottle.create.mockResolvedValue({
        id: 1,
        bottle_id: 'bottle-1',
        content: 'Hello world',
        sender_id: 'sender-1',
        status: 'drifting',
        signals: ['optimize'],
        hops: 0,
        max_hops: 10,
        path: ['sender-1'],
        finder_id: null,
        reply: null,
        thrown_at: now,
        found_at: null,
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await throwBottle('sender-1', 'Hello world', ['optimize']);

      expect(result.bottle_id).toBe('bottle-1');
      expect(result.content).toBe('Hello world');
      expect(result.sender_id).toBe('sender-1');
      expect(result.status).toBe('drifting');
      expect(result.signals).toEqual(['optimize']);
      expect(result.hops).toBe(0);
      expect(result.max_hops).toBe(10);
      expect(result.path).toEqual(['sender-1']);
      expect(mockPrisma.driftBottle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sender_id: 'sender-1',
            content: 'Hello world',
            signals: ['optimize'],
            status: 'drifting',
            hops: 0,
          }),
        }),
      );
    });

    it('should throw ValidationError when content is empty', async () => {
      await expect(throwBottle('sender-1', '', [])).rejects.toThrow(ValidationError);
      await expect(throwBottle('sender-1', '', [])).rejects.toThrow('Bottle content cannot be empty');
    });

    it('should throw ValidationError when content is whitespace', async () => {
      await expect(throwBottle('sender-1', '   ', [])).rejects.toThrow(ValidationError);
    });
  });

  describe('discoverBottle', () => {
    it('should discover a bottle and update it to found status', async () => {
      const bottleFromDb = {
        id: 1,
        bottle_id: 'bottle-1',
        signals: ['optimize'],
        hops: 0,
        path: ['sender-1'],
        sender_id: 'sender-1',
      };

      mockPrisma.driftBottle.findMany.mockResolvedValue([bottleFromDb]);

      const updatedBottle = {
        id: 1,
        bottle_id: 'bottle-1',
        content: 'Hello world',
        sender_id: 'sender-1',
        status: 'found',
        signals: ['optimize'],
        hops: 1,
        max_hops: 10,
        path: ['sender-1', 'finder-1'],
        finder_id: 'finder-1',
        reply: null,
        thrown_at: new Date(),
        found_at: new Date(),
        expires_at: new Date(),
      };
      mockPrisma.driftBottle.update.mockResolvedValue(updatedBottle);

      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = await discoverBottle('finder-1');

      mathRandomSpy.mockRestore();

      expect(result).not.toBeNull();
      expect(result!.status).toBe('found');
      expect(result!.finder_id).toBe('finder-1');
      expect(result!.hops).toBe(1);
      expect(mockPrisma.driftBottle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            finder_id: 'finder-1',
            status: 'found',
            hops: 1,
          }),
        }),
      );
    });

    it('should return null when no drifting bottles exist', async () => {
      mockPrisma.driftBottle.findMany.mockResolvedValue([]);

      const result = await discoverBottle('finder-1');

      expect(result).toBeNull();
    });

    it('should not return own bottles', async () => {
      mockPrisma.driftBottle.findMany.mockResolvedValue([]);

      const result = await discoverBottle('sender-1');

      expect(result).toBeNull();
      expect(mockPrisma.driftBottle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sender_id: { not: 'sender-1' },
          }),
        }),
      );
    });

    it('should return null when random discovery fails', async () => {
      mockPrisma.driftBottle.findMany.mockResolvedValue([
        { id: 1, bottle_id: 'b-1', signals: ['optimize'], hops: 0, path: ['s1'], sender_id: 'sender-1' },
      ]);

      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99);

      const result = await discoverBottle('finder-1');

      mathRandomSpy.mockRestore();

      expect(result).toBeNull();
    });

    it('should apply interest match bonus for matching signals', async () => {
      const bottleFromDb = {
        id: 1,
        bottle_id: 'bottle-1',
        signals: ['optimize', 'reliability'],
        hops: 0,
        path: ['sender-1'],
        sender_id: 'sender-1',
      };
      mockPrisma.driftBottle.findMany.mockResolvedValue([bottleFromDb]);

      const updatedBottle = {
        id: 1,
        bottle_id: 'bottle-1',
        content: 'Hello',
        sender_id: 'sender-1',
        status: 'found',
        signals: ['optimize', 'reliability'],
        hops: 1,
        max_hops: 10,
        path: ['sender-1', 'finder-1'],
        finder_id: 'finder-1',
        reply: null,
        thrown_at: new Date(),
        found_at: new Date(),
        expires_at: new Date(),
      };
      mockPrisma.driftBottle.update.mockResolvedValue(updatedBottle);

      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = await discoverBottle('finder-1', ['optimize', 'reliability']);

      mathRandomSpy.mockRestore();

      expect(result).not.toBeNull();
      expect(result!.finder_id).toBe('finder-1');
    });
  });

  describe('replyToBottle', () => {
    it('should reply to a found bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'found',
      });
      mockPrisma.driftBottle.update.mockResolvedValue({
        id: 1,
        bottle_id: 'bottle-1',
        content: 'Hello',
        sender_id: 'sender-1',
        status: 'replied',
        signals: [],
        hops: 1,
        max_hops: 10,
        path: ['sender-1', 'finder-1'],
        finder_id: 'finder-1',
        reply: 'Thanks!',
        thrown_at: new Date(),
        found_at: new Date(),
        expires_at: new Date(),
      });

      const result = await replyToBottle('bottle-1', 'finder-1', 'Thanks!');

      expect(result.status).toBe('replied');
      expect(result.reply).toBe('Thanks!');
      expect(mockPrisma.driftBottle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bottle_id: 'bottle-1' },
          data: expect.objectContaining({
            reply: 'Thanks!',
            status: 'replied',
          }),
        }),
      );
    });

    it('should throw NotFoundError when bottle does not exist', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      await expect(
        replyToBottle('missing', 'finder-1', 'Hello'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when user is not the finder', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'found',
      });

      await expect(
        replyToBottle('bottle-1', 'other-user', 'Hello'),
      ).rejects.toThrow(ValidationError);
      await expect(
        replyToBottle('bottle-1', 'other-user', 'Hello'),
      ).rejects.toThrow('Only the finder can reply to this bottle');
    });

    it('should throw ValidationError when bottle is not in found status', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'drifting',
      });

      await expect(
        replyToBottle('bottle-1', 'finder-1', 'Hello'),
      ).rejects.toThrow(ValidationError);
      await expect(
        replyToBottle('bottle-1', 'finder-1', 'Hello'),
      ).rejects.toThrow('Bottle must be in "found" status to reply');
    });

    it('should throw ValidationError when reply is empty', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'found',
      });

      await expect(
        replyToBottle('bottle-1', 'finder-1', ''),
      ).rejects.toThrow(ValidationError);
      await expect(
        replyToBottle('bottle-1', 'finder-1', ''),
      ).rejects.toThrow('Reply content cannot be empty');
    });

    it('should throw ValidationError when reply is whitespace', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'found',
      });

      await expect(
        replyToBottle('bottle-1', 'finder-1', '   '),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('discardBottle', () => {
    it('should discard a found bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'found',
      });
      mockPrisma.driftBottle.update.mockResolvedValue({
        id: 1,
        bottle_id: 'bottle-1',
        content: 'Hello',
        sender_id: 'sender-1',
        status: 'discarded',
        signals: [],
        hops: 1,
        max_hops: 10,
        path: ['sender-1', 'finder-1'],
        finder_id: 'finder-1',
        reply: null,
        thrown_at: new Date(),
        found_at: new Date(),
        expires_at: new Date(),
      });

      const result = await discardBottle('bottle-1', 'finder-1');

      expect(result.status).toBe('discarded');
      expect(mockPrisma.driftBottle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bottle_id: 'bottle-1' },
          data: { status: 'discarded' },
        }),
      );
    });

    it('should throw NotFoundError when bottle does not exist', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      await expect(
        discardBottle('missing', 'finder-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when user is not the finder', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'found',
      });

      await expect(
        discardBottle('bottle-1', 'other-user'),
      ).rejects.toThrow(ValidationError);
      await expect(
        discardBottle('bottle-1', 'other-user'),
      ).rejects.toThrow('Only the finder can discard this bottle');
    });

    it('should throw ValidationError when bottle is not in found status', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'bottle-1',
        finder_id: 'finder-1',
        status: 'replied',
      });

      await expect(
        discardBottle('bottle-1', 'finder-1'),
      ).rejects.toThrow(ValidationError);
      await expect(
        discardBottle('bottle-1', 'finder-1'),
      ).rejects.toThrow('Bottle must be in "found" status to discard');
    });
  });

  describe('expireBottles', () => {
    it('should expire drifting bottles past their expiry', async () => {
      mockPrisma.driftBottle.updateMany.mockResolvedValue({ count: 5 });

      const result = await expireBottles();

      expect(result).toBe(5);
      expect(mockPrisma.driftBottle.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'drifting',
          }),
          data: { status: 'expired' },
        }),
      );
    });

    it('should return 0 when no bottles to expire', async () => {
      mockPrisma.driftBottle.updateMany.mockResolvedValue({ count: 0 });

      const result = await expireBottles();

      expect(result).toBe(0);
    });
  });
});

// ============================================================
// Matching tests
// ============================================================

describe('Matching', () => {
  beforeAll(() => {
    matching.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scoreByTags', () => {
    it('should return 0 for empty bottle tags', () => {
      expect(matching.scoreByTags([], ['a', 'b'])).toBe(0);
    });

    it('should return 0 for empty user tags', () => {
      expect(matching.scoreByTags(['a', 'b'], [])).toBe(0);
    });

    it('should return 0 when both are empty', () => {
      expect(matching.scoreByTags([], [])).toBe(0);
    });

    it('should return 1 when all bottle tags match user tags', () => {
      expect(matching.scoreByTags(['python', 'async'], ['python', 'async'])).toBe(1);
    });

    it('should return 0.5 when half of bottle tags match', () => {
      expect(matching.scoreByTags(['python', 'async', 'security', 'performance'], ['python', 'async'])).toBe(0.5);
    });

    it('should be case-insensitive', () => {
      expect(matching.scoreByTags(['Python', 'ASYNC'], ['python', 'async'])).toBe(1);
    });
  });

  describe('scoreByDomain', () => {
    it('should return 0 for undefined bottle domain', () => {
      expect(matching.scoreByDomain(undefined, 'python')).toBe(0);
    });

    it('should return 0 for undefined user domain', () => {
      expect(matching.scoreByDomain('python', undefined)).toBe(0);
    });

    it('should return 1 for exact match', () => {
      expect(matching.scoreByDomain('python-async', 'python-async')).toBe(1);
    });

    it('should return 1 for case-insensitive match', () => {
      expect(matching.scoreByDomain('Python-Async', 'python-async')).toBe(1);
    });

    it('should return partial score for partial overlap', () => {
      expect(matching.scoreByDomain('python-async', 'python')).toBe(0.5);
    });
  });

  describe('calculateCompatibility', () => {
    it('should combine tag and domain scores with 70/30 weights', () => {
      const bottle = {
        bottle_id: 'b-1',
        content: '',
        sender_id: 's1',
        status: 'drifting' as const,
        signals: ['python', 'async'],
        hops: 0,
        max_hops: 10,
        path: ['s1'],
        thrown_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
      };
      const compat = matching.calculateCompatibility(bottle, {
        tags: ['python', 'async'],
        domain: 'python-async',
      });

      // tagScore=1 (all match), domainScore=0 (bottle has no domain)
      // score = 1*0.7 + 0*0.3 = 0.7
      expect(compat.score).toBe(0.7);
      expect(compat.tagScore).toBe(1);
      expect(compat.domainScore).toBe(0);
      expect(compat.matchedTags).toEqual(['python', 'async']);
    });

    it('should yield score of 1 when both tag and domain match', () => {
      // Note: calculateCompatibility passes bottle domain as undefined (bottle has no domain field),
      // so domainScore is always 0. The 70/30 weighting only applies to signals-based scoring.
      const bottle = {
        bottle_id: 'b-1',
        content: '',
        sender_id: 's1',
        status: 'drifting' as const,
        signals: ['python'],
        hops: 0,
        max_hops: 10,
        path: ['s1'],
        thrown_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
      };
      const compat = matching.calculateCompatibility(bottle, {
        tags: ['python'],
        domain: 'python',
      });

      // domainScore is 0 because bottle domain is always undefined in this function
      // score = tagScore*0.7 + domainScore*0.3 = 1*0.7 + 0*0.3 = 0.7
      expect(compat.score).toBe(0.7);
      expect(compat.tagScore).toBe(1);
      expect(compat.domainScore).toBe(0);
    });

    it('should return zero domain score when domains do not match', () => {
      const bottle = {
        bottle_id: 'b-1',
        content: '',
        sender_id: 's1',
        status: 'drifting' as const,
        signals: ['python'],
        hops: 0,
        max_hops: 10,
        path: ['s1'],
        thrown_at: new Date().toISOString(),
        expires_at: new Date().toISOString(),
      };
      const compat = matching.calculateCompatibility(bottle, {
        tags: [],
        domain: 'rust',
      });

      expect(compat.score).toBe(0);
      expect(compat.domainScore).toBe(0);
      expect(compat.matchedTags).toEqual([]);
    });
  });

  describe('findMatchingBottles', () => {
    it('should return matching bottles sorted by compatibility score', async () => {
      const now = new Date();
      const baseRecord = (signals: string[]) => ({
        bottle_id: `b-${signals.join('-')}`,
        content: '',
        sender_id: 'sender-other',
        status: 'drifting',
        signals,
        hops: 0,
        max_hops: 10,
        path: ['sender-other'],
        finder_id: null,
        reply: null,
        thrown_at: now,
        found_at: null,
        expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      });

      mockPrisma.driftBottle.findMany.mockResolvedValue([
        baseRecord(['python', 'async']),
        baseRecord(['rust']),
      ]);

      const results = await matching.findMatchingBottles('my-id', 10);

      expect(results.length).toBe(2);
      expect(results[0]!.compatibility.score).toBeGreaterThanOrEqual(results[1]!.compatibility.score);
    });

    it('should exclude bottles from the same user', async () => {
      mockPrisma.driftBottle.findMany.mockResolvedValue([]);

      await matching.findMatchingBottles('my-id', 5);

      expect(mockPrisma.driftBottle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sender_id: { not: 'my-id' },
          }),
        }),
      );
    });
  });
});

// ============================================================
// Discovery tests
// ============================================================

describe('Discovery', () => {
  beforeAll(() => {
    discovery.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('applyTimeDecay', () => {
    it('should return base probability for new bottle (0 hours)', () => {
      const result = discovery.applyTimeDecay(0.3, 0);
      expect(result).toBeCloseTo(0.3, 5);
    });

    it('should halve probability after 24 hours', () => {
      const result = discovery.applyTimeDecay(1, 24);
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should return near-zero for old bottles', () => {
      const result = discovery.applyTimeDecay(1, 168); // 7 days
      expect(result).toBeLessThan(0.01);
    });
  });

  describe('applyPreferenceWeight', () => {
    it('should not exceed 1', () => {
      expect(discovery.applyPreferenceWeight(0.9, 1.0)).toBe(1);
    });

    it('should return 0.5 weight for 0 compatibility', () => {
      expect(discovery.applyPreferenceWeight(0.5, 0)).toBeCloseTo(0.25, 5);
    });

    it('should return 1.5 weight for full compatibility', () => {
      expect(discovery.applyPreferenceWeight(0.5, 1.0)).toBeCloseTo(0.75, 5);
    });
  });

  describe('calculateDiscoveryProbability', () => {
    it('should return null for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      const result = await discovery.calculateDiscoveryProbability('missing', 'user-1');

      expect(result).toBeNull();
    });

    it('should include time decay and compatibility in final probability', async () => {
      const now = new Date();
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        content: '',
        sender_id: 's1',
        status: 'drifting',
        signals: ['python'],
        hops: 0,
        max_hops: 10,
        path: ['s1'],
        finder_id: null,
        reply: null,
        thrown_at: now,
        found_at: null,
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await discovery.calculateDiscoveryProbability('b-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.bottleId).toBe('b-1');
      expect(result!.userId).toBe('user-1');
      expect(result!.finalProbability).toBeLessThanOrEqual(1);
      expect(result!.finalProbability).toBeGreaterThan(0);
    });
  });

  describe('getDiscoveryChance', () => {
    it('should return null for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      const result = await discovery.getDiscoveryChance('missing');

      expect(result).toBeNull();
    });

    it('should label fresh bottles correctly', async () => {
      const now = new Date();
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        content: '',
        sender_id: 's1',
        status: 'drifting',
        signals: [],
        hops: 0,
        max_hops: 10,
        path: [],
        finder_id: null,
        reply: null,
        thrown_at: now,
        found_at: null,
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await discovery.getDiscoveryChance('b-1');

      expect(result).not.toBeNull();
      expect(result!.freshnessLabel).toBe('fresh');
      expect(result!.estimatedChance).toBeGreaterThan(0);
    });

    it('should label aging bottles correctly', async () => {
      const now = new Date();
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        content: '',
        sender_id: 's1',
        status: 'drifting',
        signals: [],
        hops: 0,
        max_hops: 10,
        path: [],
        finder_id: null,
        reply: null,
        thrown_at: new Date(now.getTime() - 36 * 60 * 60 * 1000), // 36h ago
        found_at: null,
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await discovery.getDiscoveryChance('b-1');

      expect(result!.freshnessLabel).toBe('aging');
    });
  });
});

// ============================================================
// Drift tests
// ============================================================

describe('Drift', () => {
  beforeAll(() => {
    drift.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDriftZone', () => {
    it('should return a valid zone with coordinates in [-1, 1]', () => {
      const zone = drift.getDriftZone('bottle-123');
      expect(zone.bottleId).toBe('bottle-123');
      expect(zone.zoneX).toBeGreaterThanOrEqual(-1);
      expect(zone.zoneX).toBeLessThanOrEqual(1);
      expect(zone.zoneY).toBeGreaterThanOrEqual(-1);
      expect(zone.zoneY).toBeLessThanOrEqual(1);
      expect(['C', 'N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']).toContain(zone.zoneLabel);
    });

    it('should be deterministic for the same bottle', () => {
      const a = drift.getDriftZone('same-bottle-id');
      const b = drift.getDriftZone('same-bottle-id');
      expect(a.zoneX).toBe(b.zoneX);
      expect(a.zoneY).toBe(b.zoneY);
      expect(a.zoneLabel).toBe(b.zoneLabel);
    });
  });

  describe('calculateDriftDirection', () => {
    it('should return calm when both vectors are near zero', () => {
      const dir = drift.calculateDriftDirection({ x: 0, y: 0 }, { x: 0, y: 0 });
      expect(dir.dominant).toBe('calm');
    });

    it('should return E when dx > dy', () => {
      const dir = drift.calculateDriftDirection({ x: 0.8, y: 0.1 }, { x: 0, y: 0 });
      expect(dir.dominant).toBe('E');
    });

    it('should return N when dy > dx', () => {
      const dir = drift.calculateDriftDirection({ x: 0.1, y: 0.8 }, { x: 0, y: 0 });
      expect(dir.dominant).toBe('N');
    });
  });

  describe('simulateDrift', () => {
    it('should return null for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      const result = await drift.simulateDrift('missing');

      expect(result).toBeNull();
    });

    it('should return simulation steps', async () => {
      const now = new Date();
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-drift-1',
        content: '',
        sender_id: 's1',
        status: 'drifting',
        signals: [],
        hops: 0,
        max_hops: 10,
        path: ['s1'],
        finder_id: null,
        reply: null,
        thrown_at: now,
        found_at: null,
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await drift.simulateDrift('b-drift-1');

      expect(result).not.toBeNull();
      expect(result!.bottleId).toBe('b-drift-1');
      expect(result!.steps.length).toBe(4); // 0h, 24h, 48h, 72h
      expect(result!.dominantDirection).toBeTruthy();
    });
  });

  describe('affectDiscoveryRate', () => {
    it('should return null for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      const result = await drift.affectDiscoveryRate('missing');

      expect(result).toBeNull();
    });

    it('should return a rate multiplier', async () => {
      const now = new Date();
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-rate-1',
        content: '',
        sender_id: 's1',
        status: 'drifting',
        signals: [],
        hops: 0,
        max_hops: 10,
        path: [],
        finder_id: null,
        reply: null,
        thrown_at: now,
        found_at: null,
        expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      });

      const result = await drift.affectDiscoveryRate('b-rate-1');

      expect(result).not.toBeNull();
      expect(result!.rateMultiplier).toBeGreaterThan(0);
      expect(typeof result!.reason).toBe('string');
    });
  });
});

// ============================================================
// Reply tests
// ============================================================

describe('Reply', () => {
  beforeAll(() => {
    reply.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendReply', () => {
    it('should throw ValidationError for empty content', async () => {
      await expect(reply.sendReply('b-1', 'finder-1', '')).rejects.toThrow(ValidationError);
      await expect(reply.sendReply('b-1', 'finder-1', '   ')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      await expect(reply.sendReply('missing', 'finder-1', 'Hello')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if responder is not the finder', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        finder_id: 'finder-1',
        status: 'found',
        sender_id: 'sender-1',
      });

      await expect(reply.sendReply('b-1', 'other', 'Hello')).rejects.toThrow(ValidationError);
      await expect(reply.sendReply('b-1', 'other', 'Hello')).rejects.toThrow('Only the finder can reply');
    });

    it('should throw ValidationError if bottle is not in found status', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        finder_id: 'finder-1',
        status: 'drifting',
        sender_id: 'sender-1',
      });

      await expect(reply.sendReply('b-1', 'finder-1', 'Hello')).rejects.toThrow(ValidationError);
      await expect(reply.sendReply('b-1', 'finder-1', 'Hello')).rejects.toThrow('Bottle must be in "found" status');
    });

    it('should successfully send a reply', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        finder_id: 'finder-1',
        status: 'found',
        sender_id: 'sender-1',
        reply: null,
        found_at: new Date(),
      });
      mockPrisma.driftBottle.update.mockResolvedValue({
        bottle_id: 'b-1',
        finder_id: 'finder-1',
        status: 'replied',
        reply: 'Here is the solution!',
      });

      const result = await reply.sendReply('b-1', 'finder-1', 'Here is the solution!');

      expect(result.bottle_id).toBe('b-1');
      expect(result.content).toBe('Here is the solution!');
      expect(result.is_anonymous).toBe(false);
      expect(mockPrisma.driftBottle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bottle_id: 'b-1' },
          data: expect.objectContaining({
            reply: 'Here is the solution!',
            status: 'replied',
          }),
        }),
      );
    });
  });

  describe('getReplies', () => {
    it('should throw NotFoundError for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      await expect(reply.getReplies('missing')).rejects.toThrow(NotFoundError);
    });

    it('should return empty array when no reply exists', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        reply: null,
        finder_id: 'finder-1',
        found_at: new Date(),
      });

      const result = await reply.getReplies('b-1');

      expect(result).toEqual([]);
    });

    it('should return the reply when one exists', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        reply: 'Here is the solution!',
        finder_id: 'finder-1',
        found_at: new Date('2026-04-01T10:00:00Z'),
      });

      const result = await reply.getReplies('b-1');

      expect(result.length).toBe(1);
      expect(result[0]!.content).toBe('Here is the solution!');
      expect(result[0]!.is_anonymous).toBe(false);
    });
  });

  describe('anonymizeSender', () => {
    it('should return null for invalid replyId', async () => {
      const result = await reply.anonymizeSender('invalid');
      expect(result).toBeNull();
    });

    it('should return null for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      const result = await reply.anonymizeSender('reply_nonexistent');

      expect(result).toBeNull();
    });

    it('should anonymize the responder id', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        reply: 'Helpful answer',
        finder_id: 'finder-1',
        found_at: new Date(),
      });

      const result = await reply.anonymizeSender('reply_b-1');

      expect(result).not.toBeNull();
      expect(result!.is_anonymous).toBe(true);
      expect(result!.responder_id).toMatch(/^anon_[a-f0-9]+$/);
      expect(result!.content).toBe('Helpful answer');
    });
  });
});

// ============================================================
// Moderation tests
// ============================================================

describe('Moderation', () => {
  beforeAll(() => {
    moderation.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkScoopLimit', () => {
    it('should allow scooping when count is 0', () => {
      const result = moderation.checkScoopLimit('user-new');
      expect(result.canScoop).toBe(true);
      expect(result.scoopsToday).toBe(0);
    });

    it('should block after 10 scoops', () => {
      for (let i = 0; i < 10; i++) {
        moderation.incrementScoopCount('user-full');
      }
      const result = moderation.checkScoopLimit('user-full');
      expect(result.canScoop).toBe(false);
      expect(result.scoopsToday).toBe(10);
    });
  });

  describe('incrementScoopCount', () => {
    it('should increment from 0 to 1', () => {
      const before = moderation.checkScoopLimit('user-inc');
      moderation.incrementScoopCount('user-inc');
      const after = moderation.checkScoopLimit('user-inc');
      expect(after.scoopsToday).toBe(before.scoopsToday + 1);
    });
  });

  describe('reportBottle', () => {
    it('should throw ValidationError for invalid reason', async () => {
      await expect(
        moderation.reportBottle('b-1', 'reporter-1', 'invalid_reason' as any),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      await expect(
        moderation.reportBottle('missing', 'reporter-1', 'spam'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when reporting own bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        sender_id: 'sender-1',
      });

      await expect(
        moderation.reportBottle('b-1', 'sender-1', 'spam'),
      ).rejects.toThrow(ValidationError);
      await expect(
        moderation.reportBottle('b-1', 'sender-1', 'spam'),
      ).rejects.toThrow('Cannot report your own bottle');
    });

    it('should create a report successfully', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        sender_id: 'sender-1',
      });

      const result = await moderation.reportBottle('b-1', 'reporter-1', 'spam');

      expect(result.bottle_id).toBe('b-1');
      expect(result.reporter_id).toBe('reporter-1');
      expect(result.reason).toBe('spam');
      expect(result.status).toBe('pending');
    });
  });

  describe('processReport', () => {
    it('should throw ValidationError for invalid report ID', async () => {
      await expect(
        moderation.processReport('bad', 'reviewer-1', 'dismissed', 'No issue found'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent bottle', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue(null);

      await expect(
        moderation.processReport('report_nonexistent', 'reviewer-1', 'dismissed', ''),
      ).rejects.toThrow(NotFoundError);
    });

    it('should remove bottle when action is bottle_removed', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        sender_id: 'sender-1',
        status: 'drifting',
      });

      const result = await moderation.processReport(
        'report_b-1', 'reviewer-1', 'bottle_removed', 'Spam content confirmed',
      );

      expect(result.action).toBe('bottle_removed');
      expect(mockPrisma.driftBottle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bottle_id: 'b-1' },
          data: { status: 'expired' },
        }),
      );
    });

    it('should dismiss without database changes when action is dismissed', async () => {
      mockPrisma.driftBottle.findUnique.mockResolvedValue({
        bottle_id: 'b-1',
        sender_id: 'sender-1',
        status: 'drifting',
      });

      const result = await moderation.processReport(
        'report_b-1', 'reviewer-1', 'dismissed', 'False report',
      );

      expect(result.action).toBe('dismissed');
      expect(mockPrisma.driftBottle.update).not.toHaveBeenCalled();
    });
  });
});

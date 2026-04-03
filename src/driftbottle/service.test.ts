import { PrismaClient } from '@prisma/client';
import * as service from './service';
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

      // Mock Math.random to always return 0 so discovery succeeds
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

      // Mock Math.random to return 1 (probability check will fail since 1 < 0.3 is false)
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

      // Math.random returns 0 so both the probability check and the pick succeed
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

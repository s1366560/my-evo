import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  createGuild,
  joinGuild,
  leaveGuild,
  getGuild,
  listGuilds,
  getNoveltyScore,
} from './service';
import { NotFoundError, ValidationError } from '../shared/errors';
import { GUILD_MAX_MEMBERS } from '../shared/constants';

const mockPrisma = {
  guild: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  asset: {
    findMany: jest.fn(),
  },
} as any;

const mockGuildRecord = {
  guild_id: 'guild-1',
  name: 'Test Guild',
  description: 'A test guild',
  creator_id: 'creator-1',
  member_count: 1,
  total_genes: 0,
  total_capsules: 0,
  novelty_score: 0,
  status: 'active',
  created_at: new Date('2026-01-01'),
  members: [
    {
      node_id: 'creator-1',
      joined_at: new Date().toISOString(),
      contribution_score: 0,
      genes_published: 0,
      capsules_published: 0,
    },
  ],
};

describe('Community Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createGuild', () => {
    it('should create a guild successfully', async () => {
      mockPrisma.guild.findFirst.mockResolvedValue(null);
      mockPrisma.guild.create.mockResolvedValue(mockGuildRecord);

      const result = await createGuild('creator-1', 'Test Guild', 'A test guild');

      expect(result.guild_id).toBe('guild-1');
      expect(result.name).toBe('Test Guild');
      expect(result.description).toBe('A test guild');
      expect(result.creator_id).toBe('creator-1');
      expect(result.status).toBe('active');
      expect(mockPrisma.guild.findFirst).toHaveBeenCalledWith({
        where: { name: 'Test Guild' },
      });
      expect(mockPrisma.guild.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Guild',
            description: 'A test guild',
            creator_id: 'creator-1',
            member_count: 1,
            status: 'active',
          }),
        }),
      );
    });

    it('should throw ValidationError for empty name', async () => {
      await expect(createGuild('creator-1', '', 'desc'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace-only name', async () => {
      await expect(createGuild('creator-1', '   ', 'desc'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for duplicate guild name', async () => {
      mockPrisma.guild.findFirst.mockResolvedValue(mockGuildRecord);

      await expect(createGuild('creator-1', 'Test Guild', 'desc'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('joinGuild', () => {
    it('should join a guild successfully', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuildRecord);
      mockPrisma.guild.update.mockResolvedValue({
        ...mockGuildRecord,
        member_count: 2,
        members: [
          ...mockGuildRecord.members,
          {
            node_id: 'node-2',
            joined_at: expect.any(String),
            contribution_score: 0,
            genes_published: 0,
            capsules_published: 0,
          },
        ],
      });

      const result = await joinGuild('guild-1', 'node-2');

      expect(mockPrisma.guild.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guild_id: 'guild-1' },
          data: expect.objectContaining({
            member_count: 2,
          }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      await expect(joinGuild('unknown', 'node-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if guild not active', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...mockGuildRecord,
        status: 'archived',
      });

      await expect(joinGuild('guild-1', 'node-2'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if already a member', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuildRecord);

      await expect(joinGuild('guild-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when max members reached', async () => {
      const fullGuild = {
        ...mockGuildRecord,
        members: Array.from({ length: GUILD_MAX_MEMBERS }, (_, i) => ({
          node_id: `member-${i}`,
          joined_at: new Date().toISOString(),
          contribution_score: 0,
          genes_published: 0,
          capsules_published: 0,
        })),
      };

      mockPrisma.guild.findUnique.mockResolvedValue(fullGuild);

      await expect(joinGuild('guild-1', 'new-node'))
        .rejects.toThrow(ValidationError);
    });

    it('should handle guild with null members gracefully', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue({
        ...mockGuildRecord,
        members: null,
      });
      mockPrisma.guild.update.mockResolvedValue({
        ...mockGuildRecord,
        member_count: 1,
      });

      const result = await joinGuild('guild-1', 'node-2');

      expect(mockPrisma.guild.update).toHaveBeenCalled();
    });
  });

  describe('leaveGuild', () => {
    it('should leave a guild successfully', async () => {
      const guildWithMembers = {
        ...mockGuildRecord,
        members: [
          mockGuildRecord.members[0],
          {
            node_id: 'node-2',
            joined_at: new Date().toISOString(),
            contribution_score: 0,
            genes_published: 0,
            capsules_published: 0,
          },
        ],
        member_count: 2,
      };

      mockPrisma.guild.findUnique.mockResolvedValue(guildWithMembers);
      mockPrisma.guild.update.mockResolvedValue({
        ...guildWithMembers,
        member_count: 1,
        members: [mockGuildRecord.members[0]],
      });

      const result = await leaveGuild('guild-1', 'node-2');

      expect(mockPrisma.guild.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guild_id: 'guild-1' },
          data: expect.objectContaining({
            member_count: 1,
          }),
        }),
      );
    });

    it('should throw NotFoundError for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      await expect(leaveGuild('unknown', 'node-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if creator tries to leave', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuildRecord);

      await expect(leaveGuild('guild-1', 'creator-1'))
        .rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError if not a member', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuildRecord);

      await expect(leaveGuild('guild-1', 'non-member'))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getGuild', () => {
    it('should return guild by id', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(mockGuildRecord);

      const result = await getGuild('guild-1');

      expect(result).not.toBeNull();
      expect(result!.guild_id).toBe('guild-1');
      expect(result!.name).toBe('Test Guild');
    });

    it('should return null for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const result = await getGuild('unknown');

      expect(result).toBeNull();
    });
  });

  describe('listGuilds', () => {
    it('should return paginated guilds', async () => {
      const guilds = [mockGuildRecord];
      mockPrisma.guild.findMany.mockResolvedValue(guilds);
      mockPrisma.guild.count.mockResolvedValue(1);

      const result = await listGuilds(20, 0);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0]!.guild_id).toBe('guild-1');
    });

    it('should use default limit and offset', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);

      await listGuilds();

      expect(mockPrisma.guild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 0,
        }),
      );
    });

    it('should pass custom limit and offset', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);

      await listGuilds(5, 10);

      expect(mockPrisma.guild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        }),
      );
    });

    it('should filter by active status', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);

      await listGuilds();

      expect(mockPrisma.guild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        }),
      );
      expect(mockPrisma.guild.count).toHaveBeenCalledWith({
        where: { status: 'active' },
      });
    });

    it('should order by member_count descending', async () => {
      mockPrisma.guild.findMany.mockResolvedValue([]);
      mockPrisma.guild.count.mockResolvedValue(0);

      await listGuilds();

      expect(mockPrisma.guild.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { member_count: 'desc' },
        }),
      );
    });
  });

  describe('getNoveltyScore', () => {
    it('should calculate novelty score for node with unique signals', async () => {
      const nodeAssets = [
        { signals: ['rare-signal-1', 'common-signal'] },
        { signals: ['rare-signal-2'] },
      ];
      const globalAssets = [
        { signals: ['rare-signal-1'] },
        { signals: ['common-signal', 'common-signal', 'common-signal'] },
        { signals: ['common-signal'] },
        { signals: ['rare-signal-2'] },
      ];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(nodeAssets)
        .mockResolvedValueOnce(globalAssets);

      const result = await getNoveltyScore('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.unique_signals).toBe(3);
      expect(result.total_signals).toBe(3);
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should return zero score for node with no assets', async () => {
      mockPrisma.asset.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getNoveltyScore('node-1');

      expect(result.node_id).toBe('node-1');
      expect(result.score).toBe(0);
      expect(result.unique_signals).toBe(0);
      expect(result.total_signals).toBe(0);
      expect(result.rare_signal_count).toBe(0);
    });

    it('should identify rare signals correctly (frequency < 0.05)', async () => {
      const nodeAssets = [
        { signals: ['rare-signal'] },
      ];
      const globalAssets = Array.from({ length: 100 }, () => ({
        signals: ['common-signal'],
      }));
      globalAssets.push({ signals: ['rare-signal'] });

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(nodeAssets)
        .mockResolvedValueOnce(globalAssets);

      const result = await getNoveltyScore('node-1');

      expect(result.rare_signal_count).toBe(1);
      expect(result.unique_signals).toBe(1);
    });

    it('should not count common signals as rare', async () => {
      const nodeAssets = [
        { signals: ['common-signal'] },
      ];
      const globalAssets = Array.from({ length: 50 }, () => ({
        signals: ['common-signal'],
      }));

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(nodeAssets)
        .mockResolvedValueOnce(globalAssets);

      const result = await getNoveltyScore('node-1');

      expect(result.rare_signal_count).toBe(0);
    });

    it('should cap score at 100', async () => {
      const manyRareSignals = Array.from({ length: 20 }, (_, i) => `rare-${i}`);
      const nodeAssets = [{ signals: manyRareSignals }];
      const globalAssets = manyRareSignals.map((s) => ({ signals: [s] }));

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(nodeAssets)
        .mockResolvedValueOnce(globalAssets);

      const result = await getNoveltyScore('node-1');

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should count total_signals as sum of all asset signals (including duplicates)', async () => {
      const nodeAssets = [
        { signals: ['sig-a', 'sig-b'] },
        { signals: ['sig-a', 'sig-c'] },
      ];
      const globalAssets: Array<{ signals: string[] }> = [];

      mockPrisma.asset.findMany
        .mockResolvedValueOnce(nodeAssets)
        .mockResolvedValueOnce(globalAssets);

      const result = await getNoveltyScore('node-1');

      expect(result.total_signals).toBe(4);
      expect(result.unique_signals).toBe(3);
    });
  });
});

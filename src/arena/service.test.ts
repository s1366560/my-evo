import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  createSeason,
  challenge,
  submitMatch,
  getRankings,
  getSeason,
  listSeasons,
  joinMatchmaking,
  leaveMatchmaking,
  getMatchmakingStatus,
  listMatches,
  submitMatchResult,
} = service;

const mockPrisma = {
  arenaSeason: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  arenaMatch: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
} as any;

describe('Arena Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSeason', () => {
    it('should create a season with valid input', async () => {
      mockPrisma.arenaSeason.create.mockResolvedValue({
        season_id: 'season-1',
        name: 'Season One',
        status: 'upcoming',
        start_date: new Date('2025-06-01'),
        end_date: new Date('2025-07-01'),
        rankings: [],
        created_at: new Date('2025-05-01'),
      });

      const result = await createSeason(
        'Season One',
        '2025-06-01',
        '2025-07-01',
      );

      expect(result.season_id).toBe('season-1');
      expect(result.name).toBe('Season One');
      expect(result.status).toBe('upcoming');
      expect(result.total_participants).toBe(0);
      expect(result.total_matches).toBe(0);
      expect(mockPrisma.arenaSeason.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Season One',
            status: 'upcoming',
            rankings: [],
          }),
        }),
      );
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(
        createSeason('', '2025-06-01', '2025-07-01'),
      ).rejects.toThrow(ValidationError);
      await expect(
        createSeason('', '2025-06-01', '2025-07-01'),
      ).rejects.toThrow('Season name is required');
    });

    it('should throw ValidationError when name is whitespace', async () => {
      await expect(
        createSeason('   ', '2025-06-01', '2025-07-01'),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when end date is before start date', async () => {
      await expect(
        createSeason('Season', '2025-07-01', '2025-06-01'),
      ).rejects.toThrow(ValidationError);
      await expect(
        createSeason('Season', '2025-07-01', '2025-06-01'),
      ).rejects.toThrow('End date must be after start date');
    });

    it('should throw ValidationError when end date equals start date', async () => {
      await expect(
        createSeason('Season', '2025-06-01', '2025-06-01'),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('challenge', () => {
    it('should create a challenge between two different nodes', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        status: 'active',
      });
      mockPrisma.arenaMatch.create.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: null,
        status: 'pending',
        scores: {},
        created_at: new Date('2025-06-01'),
      });

      const result = await challenge('node-1', 'node-2', 'season-1');

      expect(result.match_id).toBe('match-1');
      expect(result.challenger).toBe('node-1');
      expect(result.defender).toBe('node-2');
      expect(result.status).toBe('pending');
      expect(result.winner_id).toBeNull();
    });

    it('should throw ValidationError when challenging yourself', async () => {
      await expect(
        challenge('node-1', 'node-1', 'season-1'),
      ).rejects.toThrow(ValidationError);
      await expect(
        challenge('node-1', 'node-1', 'season-1'),
      ).rejects.toThrow('Cannot challenge yourself');
    });

    it('should throw NotFoundError when season does not exist', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue(null);

      await expect(
        challenge('node-1', 'node-2', 'missing-season'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when season is not active', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        status: 'upcoming',
      });

      await expect(
        challenge('node-1', 'node-2', 'season-1'),
      ).rejects.toThrow(ValidationError);
      await expect(
        challenge('node-1', 'node-2', 'season-1'),
      ).rejects.toThrow('Season is not active');
    });
  });

  describe('submitMatch', () => {
    it('should submit match result and update Elo ratings', async () => {
      const matchData = {
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: null,
        status: 'pending',
        scores: {},
      };

      mockPrisma.arenaMatch.findUnique.mockResolvedValue(matchData);
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        rankings: [
          { node_id: 'node-1', elo: 1000 },
          { node_id: 'node-2', elo: 1000 },
        ],
      });
      mockPrisma.arenaSeason.update.mockResolvedValue({});
      mockPrisma.arenaMatch.update.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: 'node-1',
        status: 'completed',
        scores: { quality: 85 },
        created_at: new Date('2025-06-01'),
      });

      const result = await submitMatch('match-1', 'node-1', { quality: 85 });

      expect(result.match_id).toBe('match-1');
      expect(result.winner_id).toBe('node-1');
      expect(result.status).toBe('completed');
      expect(result.scores).toEqual({ quality: 85 });
      expect(mockPrisma.arenaSeason.update).toHaveBeenCalled();
      expect(mockPrisma.arenaMatch.update).toHaveBeenCalled();
    });

    it('should add new ranking entries for first-time participants', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue({
        match_id: 'match-2',
        season_id: 'season-1',
        challenger: 'new-node-1',
        defender: 'new-node-2',
        winner_id: null,
        status: 'pending',
        scores: {},
      });
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        rankings: [],
      });
      mockPrisma.arenaSeason.update.mockResolvedValue({});
      mockPrisma.arenaMatch.update.mockResolvedValue({
        match_id: 'match-2',
        season_id: 'season-1',
        challenger: 'new-node-1',
        defender: 'new-node-2',
        winner_id: 'new-node-1',
        status: 'completed',
        scores: {},
        created_at: new Date('2025-06-01'),
      });

      const result = await submitMatch('match-2', 'new-node-1', {});

      expect(result.winner_id).toBe('new-node-1');

      const updateCall = mockPrisma.arenaSeason.update.mock.calls[0]![0] as { data: { rankings: Array<{ node_id: string; elo: number }> } };
      expect(updateCall.data.rankings).toHaveLength(2);
      expect(updateCall.data.rankings[0]!.node_id).toBe('new-node-1');
      expect(updateCall.data.rankings[1]!.node_id).toBe('new-node-2');
    });

    it('should throw NotFoundError when match does not exist', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue(null);

      await expect(
        submitMatch('missing', 'node-1', {}),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when match is not pending', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        status: 'completed',
      });

      await expect(
        submitMatch('match-1', 'node-1', {}),
      ).rejects.toThrow(ValidationError);
      await expect(
        submitMatch('match-1', 'node-1', {}),
      ).rejects.toThrow('Match is not pending');
    });

    it('should throw ValidationError when winner is not a participant', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        status: 'pending',
      });

      await expect(
        submitMatch('match-1', 'node-3', {}),
      ).rejects.toThrow(ValidationError);
      await expect(
        submitMatch('match-1', 'node-3', {}),
      ).rejects.toThrow('Winner must be a match participant');
    });
  });

  describe('getRankings', () => {
    it('should return sorted rankings with match stats', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        rankings: [
          { node_id: 'node-1', elo: 1050 },
          { node_id: 'node-2', elo: 980 },
        ],
      });
      mockPrisma.arenaMatch.findMany.mockResolvedValue([
        { challenger: 'node-1', defender: 'node-2', winner_id: 'node-1' },
      ]);

      const result = await getRankings('season-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.node_id).toBe('node-1');
      expect(result[0]!.elo_rating).toBe(1050);
      expect(result[0]!.rank).toBe(1);
      expect(result[0]!.wins).toBe(1);
      expect(result[0]!.losses).toBe(0);
      expect(result[1]!.node_id).toBe('node-2');
      expect(result[1]!.rank).toBe(2);
      expect(result[1]!.wins).toBe(0);
      expect(result[1]!.losses).toBe(1);
    });

    it('should throw NotFoundError when season does not exist', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue(null);

      await expect(getRankings('missing')).rejects.toThrow(NotFoundError);
    });

    it('should handle empty rankings', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        rankings: [],
      });
      mockPrisma.arenaMatch.findMany.mockResolvedValue([]);

      const result = await getRankings('season-1');

      expect(result).toHaveLength(0);
    });

    it('should handle null rankings field', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        rankings: null,
      });
      mockPrisma.arenaMatch.findMany.mockResolvedValue([]);

      const result = await getRankings('season-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getSeason', () => {
    it('should return season detail with match count', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        name: 'Season One',
        status: 'active',
        start_date: new Date('2025-06-01'),
        end_date: new Date('2025-07-01'),
        rankings: [{ node_id: 'n1' }, { node_id: 'n2' }, { node_id: 'n3' }],
        created_at: new Date('2025-05-01'),
      });
      mockPrisma.arenaMatch.count.mockResolvedValue(15);

      const result = await getSeason('season-1');

      expect(result.season_id).toBe('season-1');
      expect(result.name).toBe('Season One');
      expect(result.total_participants).toBe(3);
      expect(result.total_matches).toBe(15);
    });

    it('should throw NotFoundError when season does not exist', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue(null);

      await expect(getSeason('missing')).rejects.toThrow(NotFoundError);
    });

    it('should handle season with no rankings', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-2',
        name: 'Empty Season',
        status: 'upcoming',
        start_date: new Date('2025-08-01'),
        end_date: new Date('2025-09-01'),
        rankings: null,
        created_at: new Date('2025-07-01'),
      });
      mockPrisma.arenaMatch.count.mockResolvedValue(0);

      const result = await getSeason('season-2');

      expect(result.total_participants).toBe(0);
      expect(result.total_matches).toBe(0);
    });
  });

  describe('listSeasons', () => {
    it('should return seasons ordered by created_at desc', async () => {
      mockPrisma.arenaSeason.findMany.mockResolvedValue([
        {
          season_id: 'season-2',
          name: 'Season Two',
          status: 'active',
          start_date: new Date('2025-08-01'),
          end_date: new Date('2025-09-01'),
          rankings: [{ node_id: 'n1' }],
          created_at: new Date('2025-07-01'),
        },
        {
          season_id: 'season-1',
          name: 'Season One',
          status: 'completed',
          start_date: new Date('2025-06-01'),
          end_date: new Date('2025-07-01'),
          rankings: [],
          created_at: new Date('2025-05-01'),
        },
      ]);

      const result = await listSeasons();

      expect(result).toHaveLength(2);
      expect(result[0]!.season_id).toBe('season-2');
      expect(result[1]!.season_id).toBe('season-1');
      expect(result[0]!.total_participants).toBe(1);
      expect(mockPrisma.arenaSeason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
          take: 20,
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.arenaSeason.findMany.mockResolvedValue([]);

      await listSeasons('active');

      expect(mockPrisma.arenaSeason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'active' },
        }),
      );
    });

    it('should respect custom limit', async () => {
      mockPrisma.arenaSeason.findMany.mockResolvedValue([]);

      await listSeasons(undefined, 5);

      expect(mockPrisma.arenaSeason.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should return empty list when no seasons exist', async () => {
      mockPrisma.arenaSeason.findMany.mockResolvedValue([]);

      const result = await listSeasons();

      expect(result).toHaveLength(0);
    });
  });

  describe('joinMatchmaking', () => {
    it('should add node to queue and return queued status', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        status: 'active',
      });

      const result = await joinMatchmaking('season-1', 'node-1');

      expect(result.status).toBe('queued');
    });

    it('should throw NotFoundError when season does not exist', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue(null);

      await expect(joinMatchmaking('missing', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when season is not active', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        status: 'upcoming',
      });

      await expect(joinMatchmaking('season-1', 'node-1')).rejects.toThrow(ValidationError);
      await expect(joinMatchmaking('season-1', 'node-1')).rejects.toThrow('Season is not active');
    });
  });

  describe('leaveMatchmaking', () => {
    it('should remove node from queue without throwing', async () => {
      // First join
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        status: 'active',
      });
      await joinMatchmaking('season-1', 'node-1');

      // Then leave - should not throw
      await expect(leaveMatchmaking('season-1', 'node-1')).resolves.not.toThrow();
    });
  });

  describe('getMatchmakingStatus', () => {
    it('should return in_queue=false when node is not in queue', async () => {
      const result = await getMatchmakingStatus('season-1', 'node-unknown');

      expect(result.in_queue).toBe(false);
    });

    it('should return in_queue=true with position when node is in queue', async () => {
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        season_id: 'season-1',
        status: 'active',
      });
      await joinMatchmaking('season-1', 'node-1');
      await joinMatchmaking('season-1', 'node-2');

      const result = await getMatchmakingStatus('season-1', 'node-1');

      expect(result.in_queue).toBe(true);
      expect(result.position).toBe(1);
    });
  });

  describe('listMatches', () => {
    it('should return matches with pagination', async () => {
      const matches = [
        { match_id: 'm-1', season_id: 'season-1', challenger: 'node-1', defender: 'node-2', winner_id: null, status: 'pending', scores: {}, created_at: new Date('2025-06-01') },
        { match_id: 'm-2', season_id: 'season-1', challenger: 'node-3', defender: 'node-4', winner_id: 'node-3', status: 'completed', scores: { quality: 80 }, created_at: new Date('2025-06-02') },
      ];
      mockPrisma.arenaMatch.findMany.mockResolvedValue(matches);
      mockPrisma.arenaMatch.count.mockResolvedValue(2);

      const result = await listMatches('season-1');

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.arenaMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { season_id: 'season-1' } }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrisma.arenaMatch.findMany.mockResolvedValue([]);
      mockPrisma.arenaMatch.count.mockResolvedValue(0);

      await listMatches('season-1', 'completed');

      expect(mockPrisma.arenaMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { season_id: 'season-1', status: 'completed' } }),
      );
    });

    it('should apply limit and offset', async () => {
      mockPrisma.arenaMatch.findMany.mockResolvedValue([]);
      mockPrisma.arenaMatch.count.mockResolvedValue(0);

      await listMatches(undefined, undefined, 10, 5);

      expect(mockPrisma.arenaMatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
    });
  });

  describe('submitMatchResult', () => {
    it('should submit match result and update Elo ratings', async () => {
      const matchData = {
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: null,
        status: 'pending',
        scores: {},
      };

      mockPrisma.arenaMatch.findUnique.mockResolvedValue(matchData);
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        rankings: [{ node_id: 'node-1', elo: 1000 }, { node_id: 'node-2', elo: 1000 }],
      });
      mockPrisma.arenaSeason.update.mockResolvedValue({});
      mockPrisma.arenaMatch.update.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: 'node-1',
        status: 'completed',
        scores: { quality: 85 },
        created_at: new Date('2025-06-01'),
      });

      const result = await submitMatchResult('match-1', 'node-1', { quality: 85 });

      expect(result.match_id).toBe('match-1');
      expect(result.winner_id).toBe('node-1');
      expect(result.status).toBe('completed');
      expect(result.scores).toEqual({ quality: 85 });
    });

    it('should use empty scores when not provided', async () => {
      const matchData = {
        match_id: 'match-2',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: null,
        status: 'pending',
        scores: {},
      };

      mockPrisma.arenaMatch.findUnique.mockResolvedValue(matchData);
      mockPrisma.arenaSeason.findUnique.mockResolvedValue({
        rankings: [{ node_id: 'node-1', elo: 1000 }, { node_id: 'node-2', elo: 1000 }],
      });
      mockPrisma.arenaSeason.update.mockResolvedValue({});
      mockPrisma.arenaMatch.update.mockResolvedValue({
        match_id: 'match-2',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        winner_id: 'node-1',
        status: 'completed',
        scores: {},
        created_at: new Date('2025-06-01'),
      });

      const result = await submitMatchResult('match-2', 'node-1');

      expect(result.scores).toEqual({});
    });

    it('should throw NotFoundError when match does not exist', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue(null);

      await expect(submitMatchResult('missing', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError when match is not pending', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        status: 'completed',
      });

      await expect(submitMatchResult('match-1', 'node-1')).rejects.toThrow(ValidationError);
      await expect(submitMatchResult('match-1', 'node-1')).rejects.toThrow('Match is not pending');
    });

    it('should throw ValidationError when winner is not a participant', async () => {
      mockPrisma.arenaMatch.findUnique.mockResolvedValue({
        match_id: 'match-1',
        season_id: 'season-1',
        challenger: 'node-1',
        defender: 'node-2',
        status: 'pending',
      });

      await expect(submitMatchResult('match-1', 'node-3')).rejects.toThrow(ValidationError);
      await expect(submitMatchResult('match-1', 'node-3')).rejects.toThrow('Winner must be a match participant');
    });
  });
});

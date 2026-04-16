import fastify, { type FastifyInstance } from 'fastify';
import { arenaRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockCreateSeason = jest.fn();
const mockJoinMatchmaking = jest.fn();
const mockLeaveMatchmaking = jest.fn();
const mockGetMatchmakingStatus = jest.fn();
const mockChallenge = jest.fn();
const mockListMatches = jest.fn();
const mockSubmitMatchResult = jest.fn();
const mockGetRankings = jest.fn();
const mockGetSeason = jest.fn();
const mockListSeasons = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  createArenaState: jest.fn(() => ({ tag: 'default-arena-state' })),
  createSeason: (...args: unknown[]) => mockCreateSeason(...args),
  joinMatchmaking: (...args: unknown[]) => mockJoinMatchmaking(...args),
  leaveMatchmaking: (...args: unknown[]) => mockLeaveMatchmaking(...args),
  getMatchmakingStatus: (...args: unknown[]) => mockGetMatchmakingStatus(...args),
  challenge: (...args: unknown[]) => mockChallenge(...args),
  listMatches: (...args: unknown[]) => mockListMatches(...args),
  submitMatchResult: (...args: unknown[]) => mockSubmitMatchResult(...args),
  getRankings: (...args: unknown[]) => mockGetRankings(...args),
  getSeason: (...args: unknown[]) => mockGetSeason(...args),
  listSeasons: (...args: unknown[]) => mockListSeasons(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Arena routes', () => {
  beforeEach(() => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    jest.clearAllMocks();
  });

  it('passes app prisma to arena read and write handlers', async () => {
    const prisma = { marker: 'arena-prisma' };
    const app = buildApp(prisma);

    mockCreateSeason.mockResolvedValue({ season_id: 'season-1' });
    mockChallenge.mockResolvedValue({ match_id: 'match-1' });
    mockListMatches
      .mockResolvedValueOnce({ items: [{ match_id: 'match-1' }], total: 1 })
      .mockResolvedValueOnce({ items: [{ match_id: 'match-1' }], total: 1 });
    mockSubmitMatchResult.mockResolvedValue({ match_id: 'match-1' });
    mockGetRankings.mockResolvedValue([]);
    mockGetSeason.mockResolvedValue({ season_id: 'season-1' });
    mockListSeasons.mockResolvedValue([]);

    try {
      await app.register(arenaRoutes, { prefix: '/arena' });
      await app.ready();

      const responses = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/arena/season',
          payload: {
            name: 'Season One',
            start_date: '2025-06-01',
            end_date: '2025-07-01',
          },
        }),
        app.inject({
          method: 'POST',
          url: '/arena/challenge',
          payload: {
            defender_id: 'node-2',
            season_id: 'season-1',
          },
        }),
        app.inject({
          method: 'GET',
          url: '/arena/matches?season_id=season-1&status=pending&limit=5&offset=2',
        }),
        app.inject({
          method: 'GET',
          url: '/arena/matches/match-1',
        }),
        app.inject({
          method: 'POST',
          url: '/arena/matches/match-1/submit',
          payload: {
            winner_id: 'node-1',
            scores: { quality: 85 },
          },
        }),
        app.inject({
          method: 'GET',
          url: '/arena/rankings/season-1',
        }),
        app.inject({
          method: 'GET',
          url: '/arena/season/season-1',
        }),
        app.inject({
          method: 'GET',
          url: '/arena/seasons?status=active&limit=3',
        }),
      ]);

      expect(responses.map((response) => response.statusCode)).toEqual([
        201,
        201,
        200,
        200,
        200,
        200,
        200,
        200,
      ]);
      expect(mockCreateSeason).toHaveBeenCalledWith(
        'Season One',
        '2025-06-01',
        '2025-07-01',
        prisma,
      );
      expect(mockChallenge).toHaveBeenCalledWith(
        'node-1',
        'node-2',
        'season-1',
        prisma,
      );
      expect(mockListMatches).toHaveBeenNthCalledWith(
        1,
        'season-1',
        'pending',
        5,
        2,
        prisma,
      );
      expect(mockListMatches).toHaveBeenNthCalledWith(
        2,
        undefined,
        undefined,
        1000,
        0,
        prisma,
      );
      expect(mockSubmitMatchResult).toHaveBeenCalledWith(
        'match-1',
        'node-1',
        { quality: 85 },
        prisma,
      );
      expect(mockGetRankings).toHaveBeenCalledWith('season-1', prisma);
      expect(mockGetSeason).toHaveBeenCalledWith('season-1', prisma);
      expect(mockListSeasons).toHaveBeenCalledWith('active', 3, prisma);
      expect(JSON.parse(responses[0]!.payload)).toEqual({
        success: true,
        season: { season_id: 'season-1' },
        data: { season_id: 'season-1' },
      });
      expect(JSON.parse(responses[1]!.payload)).toEqual({
        success: true,
        battle: { match_id: 'match-1' },
        data: { match_id: 'match-1' },
      });
      expect(JSON.parse(responses[2]!.payload)).toEqual({
        success: true,
        battles: [{ match_id: 'match-1' }],
        total: 1,
        data: [{ match_id: 'match-1' }],
        meta: { total: 1 },
      });
      expect(JSON.parse(responses[3]!.payload)).toEqual({
        success: true,
        battle: { match_id: 'match-1' },
        data: { match_id: 'match-1' },
      });
      expect(JSON.parse(responses[4]!.payload)).toEqual({
        success: true,
        battle: { match_id: 'match-1' },
        data: { match_id: 'match-1' },
      });
      expect(JSON.parse(responses[5]!.payload)).toEqual({
        success: true,
        season: 'season-1',
        leaderboard: [],
        total_participants: 0,
        data: [],
      });
      expect(JSON.parse(responses[6]!.payload)).toEqual({
        success: true,
        season: { season_id: 'season-1' },
        data: { season_id: 'season-1' },
      });
      expect(JSON.parse(responses[7]!.payload)).toEqual({
        success: true,
        seasons: [],
        total: 0,
        data: [],
      });
    } finally {
      await app.close();
    }
  });

  it('keeps matchmaking state isolated per app instance', async () => {
    const sharedPrisma = { marker: 'shared-arena-prisma' };
    const stateA = { tag: 'arena-state-a' };
    const stateB = { tag: 'arena-state-b' };
    const appA = buildApp(sharedPrisma);
    const appB = buildApp(sharedPrisma);

    mockJoinMatchmaking.mockResolvedValue({ status: 'queued' });
    mockLeaveMatchmaking.mockResolvedValue(undefined);
    mockGetMatchmakingStatus.mockResolvedValue({ in_queue: true, position: 1 });

    try {
      await appA.register(arenaRoutes, { prefix: '/arena', arenaState: stateA as any });
      await appB.register(arenaRoutes, { prefix: '/arena', arenaState: stateB as any });
      await Promise.all([appA.ready(), appB.ready()]);

      const [joinA, joinB, statusA, leaveB] = await Promise.all([
        appA.inject({
          method: 'POST',
          url: '/arena/matchmaking',
          payload: { season_id: 'season-1' },
        }),
        appB.inject({
          method: 'POST',
          url: '/arena/matchmaking',
          payload: { season_id: 'season-1' },
        }),
        appA.inject({
          method: 'GET',
          url: '/arena/matchmaking/status/season-1',
        }),
        appB.inject({
          method: 'DELETE',
          url: '/arena/matchmaking/season-1',
        }),
      ]);

      expect(joinA.statusCode).toBe(201);
      expect(joinB.statusCode).toBe(201);
      expect(statusA.statusCode).toBe(200);
      expect(leaveB.statusCode).toBe(200);
      expect(JSON.parse(joinA.payload)).toEqual({
        success: true,
        status: 'queued',
        data: { status: 'queued' },
      });
      expect(JSON.parse(statusA.payload)).toEqual({
        success: true,
        in_queue: true,
        position: 1,
        data: { in_queue: true, position: 1 },
      });
      expect(JSON.parse(leaveB.payload)).toEqual({
        success: true,
        status: 'left',
        season_id: 'season-1',
        data: { season_id: 'season-1' },
      });
      expect(mockJoinMatchmaking).toHaveBeenNthCalledWith(
        1,
        'season-1',
        'node-1',
        stateA,
        sharedPrisma,
      );
      expect(mockJoinMatchmaking).toHaveBeenNthCalledWith(
        2,
        'season-1',
        'node-1',
        stateB,
        sharedPrisma,
      );
      expect(mockGetMatchmakingStatus).toHaveBeenCalledWith(
        'season-1',
        'node-1',
        stateA,
      );
      expect(mockLeaveMatchmaking).toHaveBeenCalledWith(
        'season-1',
        'node-1',
        stateB,
      );
    } finally {
      await Promise.all([appA.close(), appB.close()]);
    }
  });
});

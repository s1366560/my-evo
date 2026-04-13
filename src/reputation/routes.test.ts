import fastify, { type FastifyInstance } from 'fastify';
import { reputationRoutes } from './routes';

const mockGetScore = jest.fn();
const mockGetHistory = jest.fn();
const mockGetLeaderboard = jest.fn();

jest.mock('./service', () => ({
  getScore: (...args: unknown[]) => mockGetScore(...args),
  getHistory: (...args: unknown[]) => mockGetHistory(...args),
  getLeaderboard: (...args: unknown[]) => mockGetLeaderboard(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Reputation routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    prisma = { marker: 'reputation-prisma' };
    app = buildApp(prisma);
    await app.register(reputationRoutes, { prefix: '/a2a' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to score, history, and leaderboard handlers', async () => {
    mockGetScore.mockResolvedValue({ node_id: 'node-1', score: 60 });
    mockGetHistory.mockResolvedValue({ items: [], total: 0 });
    mockGetLeaderboard.mockResolvedValue([]);

    const [scoreRes, historyRes, leaderboardRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/a2a/reputation/node-1',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/reputation/node-1/history?limit=5&offset=2',
      }),
      app.inject({
        method: 'GET',
        url: '/a2a/reputation/leaderboard?limit=7',
      }),
    ]);

    expect(scoreRes.statusCode).toBe(200);
    expect(historyRes.statusCode).toBe(200);
    expect(leaderboardRes.statusCode).toBe(200);
    expect(mockGetScore).toHaveBeenCalledWith('node-1', prisma);
    expect(mockGetHistory).toHaveBeenCalledWith('node-1', 5, 2, prisma);
    expect(mockGetLeaderboard).toHaveBeenCalledWith(7, prisma);
  });
});

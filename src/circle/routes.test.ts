import fastify, { type FastifyInstance } from 'fastify';
import { circleRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockContributeGene = jest.fn();
const mockCreateCircle = jest.fn();
const mockLeaveCircle = jest.fn();
const mockStartRound = jest.fn();

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
  ...jest.requireActual('./service'),
  createCircle: (...args: unknown[]) => mockCreateCircle(...args),
  contributeGene: (...args: unknown[]) => mockContributeGene(...args),
  leaveCircle: (...args: unknown[]) => mockLeaveCircle(...args),
  startRound: (...args: unknown[]) => mockStartRound(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Circle routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
  });

  it('accepts gene contributions through the circle route', async () => {
    const prisma = {
      circle: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
      },
    };
    const app = buildApp(prisma);

    try {
      mockContributeGene.mockResolvedValue({
        circle_id: 'circle-1',
        gene_pool: ['gene-1'],
      });

      await app.register(circleRoutes, { prefix: '/api/v2/circle' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v2/circle/circle-1/gene',
        payload: { gene_id: 'gene-1' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockContributeGene).toHaveBeenCalledWith('circle-1', 'node-1', 'gene-1');
    } finally {
      await app.close();
    }
  });

  it('returns gene_pool data in circle detail responses', async () => {
    const prisma = {
      circle: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({
          circle_id: 'circle-1',
          name: 'Gene Circle',
          description: 'Test',
          theme: 'genes',
          status: 'active',
          creator_id: 'node-1',
          participant_count: 2,
          gene_pool: ['gene-1', 'gene-2'],
          rounds: [],
          rounds_completed: 0,
          outcomes: [],
          entry_fee: 30,
          prize_pool: 60,
          created_at: new Date('2026-01-01T00:00:00Z'),
        }),
      },
    };
    const app = buildApp(prisma);

    try {
      await app.register(circleRoutes, { prefix: '/api/v2/circle' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/v2/circle/circle-1',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        circle: expect.objectContaining({
          circle_id: 'circle-1',
          state: 'active',
          founder_id: 'node-1',
          members: [expect.objectContaining({ node_id: 'node-1', role: 'founder' })],
          gene_pool: ['gene-1', 'gene-2'],
          config: expect.objectContaining({
            max_members: 20,
            approval_threshold: 0.6,
            voting_deadline_days: 7,
          }),
          updated_at: '2026-01-01T00:00:00.000Z',
        }),
        data: expect.objectContaining({
          gene_pool: ['gene-1', 'gene-2'],
        }),
      });
    } finally {
      await app.close();
    }
  });

  it('supports documented create and list compatibility aliases', async () => {
    const prisma = {
      circle: {
        findMany: jest.fn().mockResolvedValue([{
          circle_id: 'circle-1',
          name: 'Gene Circle',
          description: 'Test',
          theme: 'genes',
          status: 'active',
          creator_id: 'node-1',
          participant_count: 2,
          gene_pool: ['gene-1'],
          rounds_completed: 1,
          entry_fee: 30,
          prize_pool: 60,
          created_at: new Date('2026-01-01T00:00:00Z'),
        }]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
      },
    };
    const app = buildApp(prisma);

    try {
      mockCreateCircle.mockResolvedValue({
        circle_id: 'circle-2',
        name: 'Compat Circle',
        description: 'Alias create',
        theme: 'compat',
      });

      await app.register(circleRoutes, { prefix: '/a2a/circle' });
      await app.ready();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/a2a/circle/create',
        payload: {
          name: 'Compat Circle',
          description: 'Alias create',
          theme: 'compat',
        },
      });
      const listResponse = await app.inject({
        method: 'GET',
        url: '/a2a/circle/list?limit=5&offset=1',
      });
      const createPayload = JSON.parse(createResponse.payload);
      const listPayload = JSON.parse(listResponse.payload);

      expect(createResponse.statusCode).toBe(201);
      expect(mockCreateCircle).toHaveBeenCalledWith('node-1', 'Compat Circle', 'Alias create', 'compat');
      expect(createPayload).toEqual({
        success: true,
        circle_id: 'circle-2',
        state: 'forming',
        founder_id: 'node-1',
        members: [{ node_id: 'node-1', role: 'founder', contributions: 0 }],
        gene_pool: [],
        message: 'Circle created. Invite members to join.',
        circle: expect.objectContaining({
          circle_id: 'circle-2',
          creator_id: 'node-1',
          state: 'forming',
          founder_id: 'node-1',
          members: [{ node_id: 'node-1', role: 'founder', contributions: 0 }],
          config: expect.objectContaining({
            max_members: 20,
            approval_threshold: 0.6,
            voting_deadline_days: 7,
          }),
        }),
        data: {
          circle_id: 'circle-2',
          name: 'Compat Circle',
          description: 'Alias create',
          theme: 'compat',
        },
      });
      expect(listResponse.statusCode).toBe(200);
      expect(prisma.circle.findMany).toHaveBeenCalledWith({
        orderBy: { created_at: 'desc' },
        take: 5,
        skip: 1,
      });
      expect(prisma.circle.count).toHaveBeenCalledTimes(1);
      expect(listPayload).toEqual({
        success: true,
        items: [expect.objectContaining({
          circle_id: 'circle-1',
          state: 'active',
          founder_id: 'node-1',
        })],
        circles: [expect.objectContaining({
          circle_id: 'circle-1',
          state: 'active',
          founder_id: 'node-1',
        })],
        total: 1,
        data: {
          items: [expect.objectContaining({
            circle_id: 'circle-1',
            state: 'active',
            founder_id: 'node-1',
          })],
          total: 1,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('lists joined circles for the authenticated node', async () => {
    const prisma = {
      circle: {
        findMany: jest.fn().mockResolvedValue([
          {
            circle_id: 'circle-1',
            name: 'Joined Circle',
            description: 'Test',
            theme: 'genes',
            status: 'active',
            creator_id: 'node-2',
            participant_count: 2,
            members: ['node-2', 'node-1'],
            gene_pool: [],
            rounds_completed: 0,
            entry_fee: 30,
            prize_pool: 60,
            created_at: new Date('2026-01-01T00:00:00Z'),
          },
          {
            circle_id: 'circle-2',
            name: 'Other Circle',
            description: 'Ignore',
            theme: 'other',
            status: 'active',
            creator_id: 'node-3',
            participant_count: 1,
            members: ['node-3'],
            gene_pool: [],
            rounds_completed: 0,
            entry_fee: 30,
            prize_pool: 30,
            created_at: new Date('2026-01-02T00:00:00Z'),
          },
        ]),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const app = buildApp(prisma);

    try {
      await app.register(circleRoutes, { prefix: '/a2a/circle' });
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/a2a/circle/my',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        data: {
          items: [
            expect.objectContaining({
              circle_id: 'circle-1',
              name: 'Joined Circle',
            }),
          ],
          total: 1,
        },
      });
    } finally {
      await app.close();
    }
  });

  it('supports documented leave and round aliases', async () => {
    const prisma = {
      circle: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({
          rounds: [{ round_number: 1, status: 'ongoing' }],
        }),
      },
    };
    const app = buildApp(prisma);

    try {
      mockLeaveCircle.mockResolvedValue({
        circle_id: 'circle-1',
        participant_count: 1,
      });
      mockStartRound.mockResolvedValue({
        circle_id: 'circle-1',
        rounds: [{ round_number: 1, status: 'ongoing' }],
      });

      await app.register(circleRoutes, { prefix: '/a2a/circle' });
      await app.ready();

      const leaveResponse = await app.inject({
        method: 'POST',
        url: '/a2a/circle/circle-1/leave',
      });
      const roundResponse = await app.inject({
        method: 'POST',
        url: '/a2a/circle/circle-1/round',
      });
      const roundsResponse = await app.inject({
        method: 'GET',
        url: '/a2a/circle/circle-1/rounds',
      });

      expect(leaveResponse.statusCode).toBe(200);
      expect(mockLeaveCircle).toHaveBeenCalledWith('circle-1', 'node-1');
      expect(roundResponse.statusCode).toBe(200);
      expect(mockStartRound).toHaveBeenCalledWith('circle-1', 'node-1');
      expect(roundsResponse.statusCode).toBe(200);
      expect(JSON.parse(roundsResponse.payload)).toEqual({
        success: true,
        data: [{ round_number: 1, status: 'ongoing' }],
      });
    } finally {
      await app.close();
    }
  });
});

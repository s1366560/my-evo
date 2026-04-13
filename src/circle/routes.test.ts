import fastify, { type FastifyInstance } from 'fastify';
import { circleRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockContributeGene = jest.fn();

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
  contributeGene: (...args: unknown[]) => mockContributeGene(...args),
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
      expect(JSON.parse(response.payload).data.gene_pool).toEqual(['gene-1', 'gene-2']);
    } finally {
      await app.close();
    }
  });
});

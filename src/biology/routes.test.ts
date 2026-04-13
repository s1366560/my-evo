import fastify, { type FastifyInstance } from 'fastify';
import { biologyRoutes } from './routes';

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Biology routes', () => {
  it('keeps prisma isolated per app instance for symbiosis requests', async () => {
    const prismaA = {
      asset: {
        findMany: jest.fn().mockResolvedValue([
          { asset_id: 'a-1', signals: ['optimize', 'reliability', 'security'], gdi_score: 70, author_id: 'u1', downloads: 50 },
          { asset_id: 'a-2', signals: ['optimize', 'reliability', 'performance'], gdi_score: 75, author_id: 'u2', downloads: 55 },
        ]),
      },
    };
    const prismaB = {
      asset: {
        findMany: jest.fn().mockResolvedValue([
          { asset_id: 'b-1', signals: ['analysis', 'planning', 'reasoning'], gdi_score: 62, author_id: 'u3', downloads: 18 },
          { asset_id: 'b-2', signals: ['analysis', 'planning', 'memory'], gdi_score: 68, author_id: 'u4', downloads: 21 },
        ]),
      },
    };
    const appA = buildApp(prismaA);
    const appB = buildApp(prismaB);

    try {
      await appA.register(biologyRoutes, { prefix: '/api/v2/biology' });
      await appB.register(biologyRoutes, { prefix: '/api/v2/biology' });
      await Promise.all([appA.ready(), appB.ready()]);

      const [responseA, responseB] = await Promise.all([
        appA.inject({ method: 'GET', url: '/api/v2/biology/symbiosis' }),
        appB.inject({ method: 'GET', url: '/api/v2/biology/symbiosis' }),
      ]);

      expect(responseA.statusCode).toBe(200);
      expect(responseB.statusCode).toBe(200);
      expect(JSON.parse(responseA.payload).data[0].id).toBe('a-1-a-2');
      expect(JSON.parse(responseB.payload).data[0].id).toBe('b-1-b-2');
      expect(prismaA.asset.findMany).toHaveBeenCalledTimes(1);
      expect(prismaB.asset.findMany).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([appA.close(), appB.close()]);
    }
  });
});

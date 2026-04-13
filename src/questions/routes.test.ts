import fastify, { type FastifyInstance } from 'fastify';
import { questionRoutes } from './routes';

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Question routes', () => {
  it('keeps prisma isolated per app instance for list requests', async () => {
    const prismaA = {
      question: {
        findMany: jest.fn().mockResolvedValue([{ question_id: 'q-a', title: 'Question A' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const prismaB = {
      question: {
        findMany: jest.fn().mockResolvedValue([{ question_id: 'q-b', title: 'Question B' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const appA = buildApp(prismaA);
    const appB = buildApp(prismaB);

    try {
      await appA.register(questionRoutes, { prefix: '/api/v2/questions' });
      await appB.register(questionRoutes, { prefix: '/api/v2/questions' });
      await Promise.all([appA.ready(), appB.ready()]);

      const [responseA, responseB] = await Promise.all([
        appA.inject({ method: 'GET', url: '/api/v2/questions' }),
        appB.inject({ method: 'GET', url: '/api/v2/questions' }),
      ]);

      expect(responseA.statusCode).toBe(200);
      expect(responseB.statusCode).toBe(200);
      expect(JSON.parse(responseA.payload).data.items[0].question_id).toBe('q-a');
      expect(JSON.parse(responseB.payload).data.items[0].question_id).toBe('q-b');
      expect(prismaA.question.findMany).toHaveBeenCalledTimes(1);
      expect(prismaB.question.findMany).toHaveBeenCalledTimes(1);
    } finally {
      await Promise.all([appA.close(), appB.close()]);
    }
  });
});

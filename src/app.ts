import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import { HEALTH_CHECK_PATH } from './shared/constants';
import { EvoMapError } from './shared/errors';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  const prisma = new PrismaClient();

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(cookie);

  // Decorate
  app.decorate('prisma', prisma);

  // Global error handler
  app.setErrorHandler((error: Error & { validation?: unknown }, _request, reply) => {
    if (error instanceof EvoMapError) {
      void reply.status(error.statusCode).send({
        success: false,
        error: error.code,
        message: error.message,
      });
      return;
    }

    if (error.validation) {
      void reply.status(400).send({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }

    app.log.error(error);
    void reply.status(500).send({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  // Health check
  app.get(HEALTH_CHECK_PATH, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register route modules
  const { a2aRoutes } = await import('./a2a/routes');
  await app.register(a2aRoutes, { prefix: '/a2a' });

  const { assetRoutes } = await import('./assets/routes');
  await app.register(assetRoutes, { prefix: '/a2a' });

  const { creditRoutes } = await import('./credits/routes');
  await app.register(creditRoutes, { prefix: '/a2a' });

  const { reputationRoutes } = await import('./reputation/routes');
  await app.register(reputationRoutes, { prefix: '/a2a' });

  const { swarmRoutes } = await import('./swarm/routes');
  await app.register(swarmRoutes, { prefix: '/api/v2/swarm' });

  const { workerPoolRoutes } = await import('./workerpool/routes');
  await app.register(workerPoolRoutes, { prefix: '/api/v2/workerpool' });

  const { councilRoutes } = await import('./council/routes');
  await app.register(councilRoutes, { prefix: '/a2a/council' });

  const { bountyRoutes } = await import('./bounty/routes');
  await app.register(bountyRoutes, { prefix: '/api/v2/bounty' });

  const { sessionRoutes } = await import('./session/routes');
  await app.register(sessionRoutes, { prefix: '/api/v2/session' });

  const { searchRoutes } = await import('./search/routes');
  await app.register(searchRoutes, { prefix: '/search' });

  const { analyticsRoutes } = await import('./analytics/routes');
  await app.register(analyticsRoutes, { prefix: '/api/v2/analytics' });

  const { biologyRoutes } = await import('./biology/routes');
  await app.register(biologyRoutes, { prefix: '/api/v2/biology' });

  const { marketplaceRoutes } = await import('./marketplace/routes');
  await app.register(marketplaceRoutes, { prefix: '/api/v2/marketplace' });

  const { quarantineRoutes } = await import('./quarantine/routes');
  await app.register(quarantineRoutes, { prefix: '/api/v2/quarantine' });

  const { driftBottleRoutes } = await import('./driftbottle/routes');
  await app.register(driftBottleRoutes, { prefix: '/api/v2/drift-bottle' });

  const { communityRoutes } = await import('./community/routes');
  await app.register(communityRoutes, { prefix: '/api/v2/community' });

  const { circleRoutes } = await import('./circle/routes');
  await app.register(circleRoutes, { prefix: '/api/v2/circle' });

  const { kgRoutes } = await import('./kg/routes');
  await app.register(kgRoutes, { prefix: '/api/v2/kg' });

  const { arenaRoutes } = await import('./arena/routes');
  await app.register(arenaRoutes, { prefix: '/api/v2/arena' });

  const { accountRoutes } = await import('./account/routes');
  await app.register(accountRoutes, { prefix: '/account' });

  const { verifiableTrustRoutes } = await import('./verifiable_trust/routes');
  await app.register(verifiableTrustRoutes, { prefix: '/trust' });

  const { readingRoutes } = await import('./reading/routes');
  await app.register(readingRoutes, { prefix: '/api/v2/reading' });

  const { monitoringRoutes } = await import('./monitoring/routes');
  await app.register(monitoringRoutes, { prefix: '/api/v2/monitoring' });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

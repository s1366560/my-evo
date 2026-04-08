import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
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

  // Swagger / OpenAPI
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'EvoMap Hub API',
        version: '1.0.0',
        description: 'AI Agent self-evolution infrastructure API',
      },
      tags: [
        { name: 'A2A', description: 'A2A protocol & node management' },
        { name: 'Assets', description: 'Asset publishing & management' },
        { name: 'Credits', description: 'Credits & economy' },
        { name: 'Reputation', description: 'Reputation scoring' },
        { name: 'Swarm', description: 'Multi-agent swarm collaboration' },
        { name: 'Bounty', description: 'Bounty system' },
        { name: 'Council', description: 'AI governance' },
        { name: 'Trust', description: 'Trust & verifiable trust' },
        { name: 'Community', description: 'Community & guilds' },
        { name: 'Session', description: 'Collaboration sessions' },
        { name: 'Analytics', description: 'Analytics & metrics' },
        { name: 'Biology', description: 'Evolution biology' },
        { name: 'Marketplace', description: 'Asset marketplace' },
        { name: 'Quarantine', description: 'Node quarantine' },
        { name: 'DriftBottle', description: 'Drift bottle messages' },
        { name: 'Circle', description: 'Evolution circles' },
        { name: 'KnowledgeGraph', description: 'Knowledge graph' },
        { name: 'Arena', description: 'Arena rankings' },
        { name: 'Account', description: 'Account management' },
        { name: 'Search', description: 'Asset search' },
        { name: 'Sandbox', description: 'Evolution sandbox' },
        { name: 'Recipe', description: 'Recipe & organism management' },
        { name: 'Gepx', description: 'Gepx bundle import/export' },
        { name: 'Subscription', description: 'Subscription & billing' },
        { name: 'Questions', description: 'Q&A questions & answers' },
        { name: 'Disputes', description: 'Dispute resolution & appeals' },
        { name: 'AntiHallucination', description: 'Hallucination detection & memory graph' },
        { name: 'SkillStore', description: 'Skill store & marketplace' },
        { name: 'Constitution', description: 'Constitution rules, ethics & amendments' },
        { name: 'MemoryGraph', description: 'Memory graph, capability chains & confidence decay' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

  // Decorate
  app.decorate('prisma', prisma);

  // Global error handler
  app.setErrorHandler((error: Error & { validation?: unknown; statusCode?: number }, _request, reply) => {
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

    // Handle Fastify errors (e.g. FST_ERR_CTP_EMPTY_JSON_BODY) with their own statusCode
    if (error.statusCode && error.statusCode < 600) {
      void reply.status(error.statusCode).send({
        success: false,
        error: 'REQUEST_ERROR',
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
  app.get(HEALTH_CHECK_PATH, {
    schema: { tags: ['Monitoring'] },
  }, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register route modules
  const { a2aRoutes } = await import('./a2a/routes');
  await app.register(a2aRoutes, { prefix: '/a2a' });

  const { assetRoutes } = await import('./assets/routes');
  await app.register(assetRoutes, { prefix: '/assets' });

  const { claimRoutes } = await import('./claim/routes');
  await app.register(claimRoutes, { prefix: '/claim' });

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

  const { taskRoutes } = await import('./task/routes');
  await app.register(taskRoutes, { prefix: '/api/v2' });

  const { taskAliasRoutes } = await import('./task_alias/routes');
  await app.register(taskAliasRoutes, { prefix: '/task' });

  const { billingRoutes } = await import('./billing/routes');
  await app.register(billingRoutes, { prefix: '/billing' });

  const { monitoringRoutes } = await import('./monitoring/routes');
  await app.register(monitoringRoutes, { prefix: '/api/v2/monitoring' });

  const { subscriptionRoutes } = await import('./subscription/routes');
  await app.register(subscriptionRoutes, { prefix: '/api/v2/subscription' });

  const { questionRoutes } = await import('./questions/routes');
  await app.register(questionRoutes, { prefix: '/api/v2/questions' });

  const { disputeRoutes } = await import('./dispute/routes');
  await app.register(disputeRoutes, { prefix: '/api/v2/disputes' });

  const { sandboxRoutes } = await import('./sandbox/routes');
  await app.register(sandboxRoutes, { prefix: '/api/v2/sandbox' });

  const { recipeRoutes } = await import('./recipe/routes');
  await app.register(recipeRoutes, { prefix: '/api/v2/recipes' });

  const { gepxRoutes } = await import('./gepx/routes');
  await app.register(gepxRoutes, { prefix: '/api/v2/gepx' });

  const { antiHallucinationRoutes } = await import('./anti_hallucination/routes');
  await app.register(antiHallucinationRoutes, { prefix: '/api/v2/anti-hallucination' });

  const { skillStoreRoutes } = await import('./skill_store/routes');
  await app.register(skillStoreRoutes, { prefix: '/api/v2/skills' });

  const { constitutionRoutes } = await import('./constitution/routes');
  await app.register(constitutionRoutes, { prefix: '/a2a/constitution' });

  const { docsRoutes, readDocFile, SLUG_TO_FILE } = await import('./docs/routes');
  const { getConfig } = await import('./shared/config');

  // Root-level doc routes (registered before /docs prefix so they take precedence)
  // Flat .md / .txt files at root level
  for (const [, filename] of Object.entries(SLUG_TO_FILE)) {
    const route = `/${filename}`;
    app.get(route, {
      schema: { tags: ['Docs'] },
    }, async (_request, reply) => {
      const content = readDocFile(filename);
      return reply.type('text/plain').send(content);
    });
  }

  // /api/docs/wiki-full — root level
  app.get('/api/docs/wiki-full', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        pages: [
          { slug: 'getting-started', title: 'Getting Started', url: '/wiki/getting-started' },
          { slug: 'publishing', title: 'Publishing Assets', url: '/wiki/publishing' },
          { slug: 'gdi-scoring', title: 'GDI Scoring', url: '/wiki/gdi-scoring' },
          { slug: 'credits', title: 'Credits Economy', url: '/wiki/credits' },
        ],
      },
    });
  });

  // /api/wiki/index — root level
  app.get('/api/wiki/index', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Wiki',
        categories: ['Getting Started', 'Protocol', 'Assets', 'Governance', 'Marketplace'],
      },
    });
  });

  // /ai-nav — root level
  app.get('/ai-nav', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    const base = getConfig().baseUrl;
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Hub',
        description: 'AI Agent self-evolution infrastructure',
        navigation: [
          { label: 'Getting Started', url: `${base}/skill.md` },
          { label: 'Protocol Reference', url: `${base}/skill-protocol.md` },
          { label: 'Asset Structures', url: `${base}/skill-structures.md` },
          { label: 'Tasks & Bounties', url: `${base}/skill-tasks.md` },
          { label: 'Advanced Features', url: `${base}/skill-advanced.md` },
          { label: 'Platform APIs', url: `${base}/skill-platform.md` },
          { label: 'Evolver Client', url: `${base}/skill-evolver.md` },
          { label: 'API Docs', url: `${base}/docs` },
          { label: 'Wiki', url: `${base}/wiki` },
        ],
        api_base: `${base}/a2a`,
        version: '1.0.0',
      },
    });
  });

  // /economics — root level
  app.get('/economics', {
    schema: { tags: ['Docs'] },
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        title: 'EvoMap Credits Economy',
        description: 'Credits-based economy for AI Agent self-evolution',
        sections: [
          {
            title: 'Credits System',
            content: 'Nodes start with 500 credits. Credits are consumed through various operations.',
          },
          {
            title: 'Publishing Costs',
            items: [
              { asset: 'Gene', cost: 5, description: 'Unit of capability' },
              { asset: 'Capsule', cost: 10, description: 'Executable package' },
              { asset: 'Recipe', cost: 20, description: 'Composition blueprint' },
            ],
          },
          {
            title: 'Decay Rules',
            content: '5% monthly decay after 90 days of inactivity',
          },
          {
            title: 'GDI Scoring',
            items: [
              { dimension: 'Usefulness', weight: '30%' },
              { dimension: 'Novelty', weight: '25%' },
              { dimension: 'Rigor', weight: '25%' },
              { dimension: 'Reuse', weight: '20%' },
            ],
          },
        ],
        related: [
          { label: 'Credits API', url: '/a2a/credit/price' },
          { label: 'Credit Economics', url: '/a2a/credit/economics' },
          { label: 'Publishing', url: '/a2a/publish' },
        ],
      },
    });
  });

  await app.register(docsRoutes, { prefix: '/docs' });

  const { agentConfigRoutes } = await import('./agent_config/routes');
  await app.register(agentConfigRoutes, { prefix: '/api/v2' });

  const { modelTierRoutes } = await import('./model_tier/routes');
  await app.register(modelTierRoutes, { prefix: '/api/v2' });

  const { securityRoutes } = await import('./security/routes');
  await app.register(securityRoutes, { prefix: '/api/v2' });

  const { projectRoutes } = await import('./project/routes');
  await app.register(projectRoutes, { prefix: '/a2a' });

  const { memoryGraphRoutes } = await import('./memory_graph/routes');
  await app.register(memoryGraphRoutes, { prefix: '/api/v2/memory-graph' });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

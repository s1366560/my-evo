import type { FastifyInstance } from 'fastify';
import * as biologyService from './service';

export async function biologyRoutes(app: FastifyInstance): Promise<void> {
  app.get('/phylogeny/:assetId', async (request, reply) => {
    const { assetId } = request.params as { assetId: string };

    const result = await biologyService.getPhylogenyTree(assetId);

    return reply.send({ success: true, data: result });
  });

  app.get('/symbiosis', async (_request, reply) => {
    const result = await biologyService.detectSymbiosis();

    return reply.send({ success: true, data: result });
  });

  app.get('/fitness', async (_request, reply) => {
    const result = await biologyService.getFitnessLandscape();

    return reply.send({ success: true, data: result });
  });

  app.get('/emergent', async (_request, reply) => {
    const result = await biologyService.detectEmergentPatterns();

    return reply.send({ success: true, data: result });
  });

  app.get('/diversity', async (_request, reply) => {
    const result = await biologyService.getDiversityIndex();

    return reply.send({ success: true, data: result });
  });

  app.get('/red-queen', async (_request, reply) => {
    const result = await biologyService.getRedQueenEffect();

    return reply.send({ success: true, data: result });
  });

  app.get('/macro-events', async (_request, reply) => {
    const result = await biologyService.detectMacroEvents();

    return reply.send({ success: true, data: result });
  });
}

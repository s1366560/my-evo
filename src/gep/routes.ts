/**
 * GEP Routes - API endpoints for Gene, Capsule, and Node management
 * Fastify plugin format
 */

import type { FastifyInstance } from 'fastify';
import { gepService } from './service';
import {
  RegisterGeneRequest,
  RegisterCapsuleRequest,
  ValidateGepRequest,
  GepApiResponse,
  ValidationResult,
} from './types';

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: GepApiResponse['error']
): GepApiResponse<T> {
  return {
    success,
    data,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      request_id: `req_${Date.now()}`,
    },
  };
}

export default async function gepRoutes(app: FastifyInstance): Promise<void> {
  // POST /gene - register a new gene
  app.post('/gene', async (request, reply) => {
    try {
      const body = request.body as RegisterGeneRequest;
      const nodeId = (request.headers['x-node-id'] as string) || 'anonymous';
      const validation = gepService.validateGene(body);
      if (!validation.valid) {
        return reply.status(400).send(createResponse(false, undefined, {
          code: 'VALIDATION_ERROR',
          message: 'Gene validation failed',
          details: validation.errors,
        }));
      }
      const gene = await gepService.registerGene(body, nodeId);
      return reply.status(201).send(createResponse(true, gene));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(500).send(createResponse(false, undefined, { code: 'INTERNAL_ERROR', message }));
    }
  });

  // GET /gene/:id - get a gene by ID
  app.get<{ Params: { id: string } }>('/gene/:id', async (request, reply) => {
    try {
      const gene = await gepService.getGene(request.params.id);
      if (!gene) {
        return reply.status(404).send(createResponse(false, undefined, {
          code: 'NOT_FOUND',
          message: `Gene ${request.params.id} not found`,
        }));
      }
      return reply.send(createResponse(true, gene));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // GET /genes - list genes with optional filters
  app.get<{ Querystring: { node_id?: string; category?: string } }>('/genes', async (request, reply) => {
    try {
      const { node_id, category } = request.query;
      const genes = await gepService.listGenes(node_id, category as any);
      return reply.send(createResponse(true, genes));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // POST /capsule - register a new capsule
  app.post('/capsule', async (request, reply) => {
    try {
      const body = request.body as RegisterCapsuleRequest;
      const nodeId = (request.headers['x-node-id'] as string) || 'anonymous';
      const validation = gepService.validateCapsule(body);
      if (!validation.valid) {
        return reply.status(400).send(createResponse(false, undefined, {
          code: 'VALIDATION_ERROR',
          message: 'Capsule validation failed',
          details: validation.errors,
        }));
      }
      const capsule = await gepService.registerCapsule(body, nodeId);
      return reply.status(201).send(createResponse(true, capsule));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // GET /capsule/:id - get a capsule by ID
  app.get<{ Params: { id: string } }>('/capsule/:id', async (request, reply) => {
    try {
      const capsule = await gepService.getCapsule(request.params.id);
      if (!capsule) {
        return reply.status(404).send(createResponse(false, undefined, {
          code: 'NOT_FOUND',
          message: `Capsule ${request.params.id} not found`,
        }));
      }
      return reply.send(createResponse(true, capsule));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // GET /capsules - list capsules with optional node_id filter
  app.get<{ Querystring: { node_id?: string } }>('/capsules', async (request, reply) => {
    try {
      const { node_id } = request.query;
      const capsules = await gepService.listCapsules(node_id);
      return reply.send(createResponse(true, capsules));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // GET /nodes - discover nodes with optional filters
  app.get<{
    Querystring: {
      capabilities?: string;
      min_reputation?: string;
      status?: string;
      limit?: string;
    };
  }>('/nodes', async (request, reply) => {
    try {
      const { capabilities, min_reputation, status, limit } = request.query;
      const nodes = await gepService.discoverNodes(
        capabilities ? capabilities.split(',') as any : undefined,
        min_reputation ? parseInt(min_reputation, 10) : undefined,
        status as any,
        limit ? parseInt(limit, 10) : 20
      );
      return reply.send(createResponse(true, nodes));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // POST /node - register a new node
  app.post('/node', async (request, reply) => {
    try {
      const node = await gepService.registerNode(request.body as any);
      return reply.status(201).send(createResponse(true, node));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // GET /node/:id - get a node by ID
  app.get<{ Params: { id: string } }>('/node/:id', async (request, reply) => {
    try {
      const node = await gepService.getNode(request.params.id);
      if (!node) {
        return reply.status(404).send(createResponse(false, undefined, {
          code: 'NOT_FOUND',
          message: `Node ${request.params.id} not found`,
        }));
      }
      return reply.send(createResponse(true, node));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // POST /validate - validate a gene or capsule
  app.post('/validate', async (request, reply) => {
    try {
      const body = request.body as ValidateGepRequest;
      const { type, data } = body;
      if (!type || !['gene', 'capsule'].includes(type)) {
        return reply.status(400).send(createResponse(false, undefined, {
          code: 'INVALID_TYPE',
          message: 'Type must be "gene" or "capsule"',
        }));
      }
      let validation: ValidationResult;
      if (type === 'gene') {
        validation = gepService.validateGene(data as any);
      } else {
        validation = gepService.validateCapsule(data as any);
      }
      return reply.send(createResponse(true, validation));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  // GET /adapters - list available GEP adapters
  app.get('/adapters', async (_request, reply) => {
    try {
      const adapters = gepService.listAdapters();
      return reply.send(createResponse(true, adapters.map(a => ({
        name: a.name,
        ecosystem: a.ecosystem,
      }))));
    } catch (error) {
      return reply.status(500).send(createResponse(false, undefined, {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });
}

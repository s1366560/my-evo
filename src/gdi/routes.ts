/**
 * GDI Routes - API endpoints for Genetic Diversity Index scoring
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { calculateGDIScore, batchScoreAssets, getGDIScoreHistory, getGDIConfig, getGDIWeights } from './service';
import { DEFAULT_GDI_CONFIG, DEFAULT_GDI_WEIGHTS } from './types';
import type { ScoreRequest, BatchScoreRequest } from './types';

interface ScoreBody {
  asset: ScoreRequest['asset'];
  customWeights?: ScoreRequest['customWeights'];
  existingAssets?: ScoreRequest['existingAssets'];
}

interface BatchScoreBody {
  assets: BatchScoreRequest['assets'];
  customWeights?: BatchScoreRequest['customWeights'];
}

interface AssetIdParams {
  assetId: string;
}

function createResponse<T>(success: boolean, data?: T, error?: { code: string; message: string; details?: unknown }) {
  return success ? { success: true, data } : { success: false, error };
}

function sendResponse<T>(reply: FastifyReply, status: number, data: ReturnType<typeof createResponse<T>>) {
  return reply.status(status).send(data);
}

export default async function gdiRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /gdi/score - Calculate GDI score for a single asset
   */
  app.post('/score', async (request: FastifyRequest<{ Body: ScoreBody }>, reply: FastifyReply) => {
    try {
      const body = request.body as ScoreBody;
      if (!body.asset || !body.asset.asset_id) {
        return sendResponse(reply, 400, createResponse(false, undefined, {
          code: 'VALIDATION_ERROR',
          message: 'Missing required field: asset.asset_id',
        }));
      }
      const result = calculateGDIScore({
        asset: body.asset,
        customWeights: body.customWeights,
      });
      return sendResponse(reply, 200, createResponse(true, result));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendResponse(reply, 500, createResponse(false, undefined, { code: 'INTERNAL_ERROR', message }));
    }
  });

  /**
   * POST /gdi/score/batch - Calculate GDI scores for multiple assets
   */
  app.post('/score/batch', async (request: FastifyRequest<{ Body: BatchScoreBody }>, reply: FastifyReply) => {
    try {
      const body = request.body as BatchScoreBody;
      if (!body.assets || !Array.isArray(body.assets) || body.assets.length === 0) {
        return sendResponse(reply, 400, createResponse(false, undefined, {
          code: 'VALIDATION_ERROR',
          message: 'Missing or invalid field: assets (must be a non-empty array)',
        }));
      }
      const result = await batchScoreAssets({
        assets: body.assets,
        customWeights: body.customWeights,
      });
      return sendResponse(reply, 200, createResponse(true, result));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendResponse(reply, 500, createResponse(false, undefined, { code: 'INTERNAL_ERROR', message }));
    }
  });

  /**
   * GET /gdi/score/:assetId/history - Get GDI score history for an asset
   */
  app.get('/score/:assetId/history', async (request: FastifyRequest<{ Params: AssetIdParams }>, reply: FastifyReply) => {
    try {
      const { assetId } = request.params;
      const history = await getGDIScoreHistory(assetId);
      if (!history) {
        return sendResponse(reply, 404, createResponse(false, undefined, {
          code: 'NOT_FOUND',
          message: `Score history for asset ${assetId} not found`,
        }));
      }
      return sendResponse(reply, 200, createResponse(true, history));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendResponse(reply, 500, createResponse(false, undefined, { code: 'INTERNAL_ERROR', message }));
    }
  });

  /**
   * GET /gdi/config - Get default GDI configuration
   */
  app.get('/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const config = getGDIConfig();
      return sendResponse(reply, 200, createResponse(true, config));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendResponse(reply, 500, createResponse(false, undefined, { code: 'INTERNAL_ERROR', message }));
    }
  });

  /**
   * GET /gdi/weights - Get default GDI weights
   */
  app.get('/weights', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const weights = getGDIWeights();
      return sendResponse(reply, 200, createResponse(true, weights));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return sendResponse(reply, 500, createResponse(false, undefined, { code: 'INTERNAL_ERROR', message }));
    }
  });
}

// AI Generation Routes
import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { aiService } from '../ai/service.js';
import type { GenerateNodesInput, GenerateEdgesInput, GenerateContextInput } from '../ai/types.js';

const router = Router();

/**
 * GET /api/v1/ai/status
 * Returns AI service status
 */
router.get('/status', (_req, res: Response) => {
  res.json({ success: true, data: aiService.getStatus() });
});

/**
 * POST /api/v1/ai/generate/nodes
 * Generate new nodes using AI
 */
router.post('/generate/nodes', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const input: GenerateNodesInput = req.body;
    if (!input.mapId) throw new HttpError(400, 'mapId is required');
    const result = await aiService.generateNodes(input);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/ai/generate/edges
 * Generate edges using AI
 */
router.post('/generate/edges', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const input: GenerateEdgesInput = req.body;
    if (!input.mapId || !input.sourceNodeId) throw new HttpError(400, 'mapId and sourceNodeId are required');
    const result = await aiService.generateEdges(input);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/ai/suggestions
 * Generate AI suggestions for a map
 */
router.post('/suggestions', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const { mapId } = req.body;
    if (!mapId) throw new HttpError(400, 'mapId is required');
    const result = await aiService.generateSuggestions(mapId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/ai/context
 * Generate contextual content for selected nodes
 */
router.post('/context', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const input: GenerateContextInput = req.body;
    if (!input.mapId || !input.nodeIds?.length) throw new HttpError(400, 'mapId and nodeIds are required');
    const result = await aiService.generateContext(input);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/ai/expand
 * Expand a concept into detailed sub-nodes
 */
router.post('/expand', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const { mapId, nodeId, concept } = req.body;
    if (!mapId || !nodeId || !concept) throw new HttpError(400, 'mapId, nodeId, and concept are required');
    const result = await aiService.expandConcept(mapId, nodeId, concept);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { router as aiRouter };

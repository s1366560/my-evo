import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { graphEngine } from '../graph/engine.js';
import { graphAlgorithms } from '../graph/algorithms.js';

const router = Router();

router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    return res.json({ success: true, data: { message: 'Graph endpoint', userId } });
  } catch (error) {
    return next(error);
  }
});

router.get('/metrics', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const result = await graphEngine.calculateNodeMetrics(userId);
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/pagerank', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const damping = Number(req.query.damping) || 0.85;
    const iterations = Number(req.query.iterations) || 100;
    const result = await graphAlgorithms.calculatePageRank(userId, damping, iterations);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/cycles', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const result = await graphAlgorithms.detectCycles(userId);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/toposort', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const result = await graphAlgorithms.topologicalSort(userId);
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.get('/path', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const { source, target } = req.query;
    if (!source || !target) throw new HttpError(400, 'source and target query params required');
    const result = await graphAlgorithms.findPath(userId, source as string, target as string);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post('/layout', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { nodes, edges, algorithm } = req.body;
    if (!nodes || !edges) throw new HttpError(400, 'nodes and edges are required');
    const result = graphEngine.computeLayout(nodes, edges, algorithm || 'force');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/validate', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { nodes, edges } = req.body;
    if (!nodes || !edges) throw new HttpError(400, 'nodes and edges are required');
    const result = graphEngine.validateGraph(nodes, edges);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export { router as graphRouter };

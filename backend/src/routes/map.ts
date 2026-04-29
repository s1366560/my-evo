import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { isMockMode, mockStore } from '../db/index.js';
import { HttpError } from '../middleware/errorHandler.js';

const router = Router();

// Nodes
router.get('/nodes', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', mapId } = req.query as Record<string, string>;
    if (isMockMode()) {
      const nodes = await mockStore.findNodesByMapId(mapId || '');
      const p = parseInt(page), l = parseInt(limit);
      res.json({ success: true, data: nodes.slice((p-1)*l, p*l), pagination: { page: p, limit: l, total: nodes.length } });
      return;
    }
    res.json({ success: true, data: [] });
  } catch (error) { next(error); }
});

router.post('/nodes', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { mapId, label, description, nodeType, positionX, positionY, metadata } = req.body;
    if (!label || !mapId) throw new HttpError(400, 'Label and mapId required');
    if (isMockMode()) {
      const node = await mockStore.createNode({ mapId, label, description: description || '', nodeType: nodeType || 'concept', positionX: positionX || 0, positionY: positionY || 0, metadata: metadata || {} });
      res.status(201).json({ success: true, data: node });
      return;
    }
    res.status(201).json({ success: true, data: { id: 'mock_node', label, mapId } });
  } catch (error) { next(error); }
});

router.patch('/nodes/:nodeId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { label, description, metadata } = req.body;
    if (isMockMode()) {
      const updated = await mockStore.updateNode(req.params.nodeId, { ...(label && { label }), ...(description !== undefined && { description }), ...(metadata && { metadata }) });
      if (!updated) throw new HttpError(404, 'Node not found');
      res.json({ success: true, data: updated });
      return;
    }
    throw new HttpError(404, 'Node not found');
  } catch (error) { next(error); }
});

router.delete('/nodes/:nodeId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (isMockMode()) {
      const deleted = await mockStore.deleteNode(req.params.nodeId);
      if (!deleted) throw new HttpError(404, 'Node not found');
      res.json({ success: true, message: 'Node deleted' });
      return;
    }
    throw new HttpError(404, 'Node not found');
  } catch (error) { next(error); }
});

// Edges
router.get('/edges', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { mapId } = req.query as Record<string, string>;
    if (isMockMode()) {
      const edges = mapId ? await mockStore.findEdgesByMapId(mapId) : [];
      res.json({ success: true, data: edges });
      return;
    }
    res.json({ success: true, data: [] });
  } catch (error) { next(error); }
});

router.post('/edges', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { mapId, sourceId, targetId, label, metadata } = req.body;
    if (!mapId || !sourceId || !targetId) throw new HttpError(400, 'mapId, sourceId, targetId required');
    if (isMockMode()) {
      const edge = await mockStore.createEdge({ mapId, sourceId, targetId, label: label || '', metadata: metadata || {} });
      res.status(201).json({ success: true, data: edge });
      return;
    }
    res.status(201).json({ success: true, data: { id: 'mock_edge', mapId, sourceId, targetId } });
  } catch (error) { next(error); }
});

router.delete('/edges/:edgeId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (isMockMode()) {
      const deleted = await mockStore.deleteEdge(req.params.edgeId);
      if (!deleted) throw new HttpError(404, 'Edge not found');
      res.json({ success: true, message: 'Edge deleted' });
      return;
    }
    throw new HttpError(404, 'Edge not found');
  } catch (error) { next(error); }
});

// Maps
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    if (isMockMode()) {
      const maps = await mockStore.findMapsByUserId(userId);
      res.json({ success: true, data: maps });
      return;
    }
    res.json({ success: true, data: [] });
  } catch (error) { next(error); }
});

router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const { name, description, isPublic } = req.body;
    if (!name) throw new HttpError(400, 'Name required');
    if (isMockMode()) {
      const map = await mockStore.createMap({ userId, name, description: description || '', isPublic: isPublic || false });
      res.status(201).json({ success: true, data: map });
      return;
    }
    res.status(201).json({ success: true, data: { id: 'mock_map', name, userId } });
  } catch (error) { next(error); }
});

router.get('/:mapId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    if (isMockMode()) {
      const map = await mockStore.findMapById(req.params.mapId);
      if (!map) throw new HttpError(404, 'Map not found');
      res.json({ success: true, data: map });
      return;
    }
    throw new HttpError(404, 'Map not found');
  } catch (error) { next(error); }
});

router.patch('/:mapId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    const { name, description, isPublic } = req.body;
    if (isMockMode()) {
      const updated = await mockStore.updateMap(req.params.mapId, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      });
      if (!updated) throw new HttpError(404, 'Map not found');
      res.json({ success: true, data: updated });
      return;
    }
    throw new HttpError(404, 'Map not found');
  } catch (error) { next(error); }
});

router.delete('/:mapId', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');
    if (isMockMode()) {
      const deleted = await mockStore.deleteMap(req.params.mapId);
      if (!deleted) throw new HttpError(404, 'Map not found');
      res.json({ success: true, message: 'Map deleted' });
      return;
    }
    throw new HttpError(404, 'Map not found');
  } catch (error) { next(error); }
});

export { router as mapRouter };

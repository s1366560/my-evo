import { Router, Request, Response } from 'express';
import * as kg from './index';

const router = Router();

// POST /api/v2/kg/query
router.post('/query', (req: Request, res: Response) => {
  try {
    const result = kg.query(req.body as kg.KGQuery);
    res.json(result);
  } catch (error) {
    console.error('KG query error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /api/v2/kg/node/:type/:id
router.get('/node/:type/:id', (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const entity = kg.getEntity(id);

    if (!entity) {
      res.status(404).json({ error: 'entity_not_found', message: `Entity ${id} not found` });
      return;
    }

    if (entity.type !== type) {
      res.status(400).json({ error: 'type_mismatch', message: `Entity type is ${entity.type}, not ${type}` });
      return;
    }

    res.json(entity);
  } catch (error) {
    console.error('KG node error:', error);
    res.status(500).json({ error: 'fetch_failed', message: String(error) });
  }
});

// GET /api/v2/kg/node/:type/:id/neighbors
router.get('/node/:type/:id/neighbors', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const maxDepth = parseInt(req.query.max_depth as string) || 1;
    const result = kg.getNeighborsResult(id, maxDepth);

    if (!result) {
      res.status(404).json({ error: 'entity_not_found', message: `Entity ${id} not found` });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('KG neighbors error:', error);
    res.status(500).json({ error: 'fetch_failed', message: String(error) });
  }
});

// POST /api/v2/kg/node
router.post('/node', (req: Request, res: Response) => {
  try {
    const entity = kg.addEntity(req.body);
    res.status(201).json(entity);
  } catch (error) {
    console.error('KG create error:', error);
    res.status(500).json({ error: 'create_failed', message: String(error) });
  }
});

// POST /api/v2/kg/relationship
router.post('/relationship', (req: Request, res: Response) => {
  try {
    const rel = kg.addRelationship(req.body);
    res.status(201).json(rel);
  } catch (error) {
    console.error('KG relationship error:', error);
    res.status(500).json({ error: 'create_failed', message: String(error) });
  }
});

// GET /api/v2/kg/stats
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = kg.getStats();
    res.json(stats);
  } catch (error) {
    console.error('KG stats error:', error);
    res.status(500).json({ error: 'stats_failed', message: String(error) });
  }
});

// GET /api/v2/kg/types/:type
router.get('/types/:type', (req: Request, res: Response) => {
  try {
    const entities = kg.getEntitiesByType(req.params.type as kg.EntityType);
    res.json({ entities, total: entities.length });
  } catch (error) {
    console.error('KG type query error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

export default router;

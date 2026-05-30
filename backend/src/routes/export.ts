// Export Routes
import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { exportService } from '../export/service.js';
import { getPrisma } from '../db/index.js';

const router = Router();

/**
 * POST /api/v1/export/map
 * Export a map in the specified format
 */
router.post('/map', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');

    const { mapId, format, includeMetadata, includeEdges } = req.body;
    if (!mapId || !format) throw new HttpError(400, 'mapId and format are required');

    const db = getPrisma();
    if (!db) {
      res.status(503).json({ success: false, error: 'Database not available' });
      return;
    }

    // Fetch map with nodes and edges
    const map = await db.map.findFirst({
      where: { id: mapId, ownerId: userId },
      include: { nodes: true, edges: true },
    });

    if (!map) throw new HttpError(404, 'Map not found');

    const result = await exportService.exportMap(
      mapId,
      map.nodes,
      map.edges,
      { format, includeMetadata, includeEdges }
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/export/import
 * Import a map from JSON format
 */
router.post('/import', authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new HttpError(401, 'Authentication required');

    const { content, name } = req.body;
    if (!content) throw new HttpError(400, 'content is required');

    const db = getPrisma();
    if (!db) {
      res.status(503).json({ success: false, error: 'Database not available' });
      return;
    }

    // Parse and validate JSON
    let mapData: any;
    try {
      mapData = typeof content === 'string' ? JSON.parse(content) : content;
    } catch {
      throw new HttpError(400, 'Invalid JSON content');
    }

    // Create map with nodes
    const map = await db.map.create({
      data: {
        name: name || `Imported ${new Date().toISOString()}`,
        ownerId: userId,
        nodes: {
          create: (mapData.nodes || []).map((n: any) => ({
            name: n.label || n.name,
            type: n.type || 'concept',
            description: n.description,
            metadata: n.metadata || {},
          })),
        },
        edges: {
          create: (mapData.edges || []).map((e: any) => ({
            sourceId: e.source,
            targetId: e.target,
            description: e.label,
            metadata: e.metadata || {},
          })),
        },
      },
    });

    res.status(201).json({ success: true, data: map });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/export/formats
 * List supported export formats
 */
router.get('/formats', (_req, res: Response) => {
  const formats = exportService.getSupportedFormats();
  res.json({
    success: true,
    data: { formats },
  });
});

export { router as exportRouter };

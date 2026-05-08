import { Router } from 'express';
import { mapController } from '../controllers/mapController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /map/nodes - Get all map nodes
router.get('/nodes', (req, res) => {
  mapController.getNodes(req, res);
});

// GET /map/edges - Get all map edges
router.get('/edges', (req, res) => {
  mapController.getEdges(req, res);
});

// GET /map/graph - Get full graph
router.get('/graph', (req, res) => {
  mapController.getGraph(req, res);
});

// POST /map/node - Create a map node
router.post('/node', (req, res) => {
  mapController.createNode(req, res);
});

// PUT /map/node/:mapNodeId - Update a map node
router.put('/node/:mapNodeId', (req, res) => {
  mapController.updateNode(req, res);
});

// POST /map/edge - Create an edge
router.post('/edge', (req, res) => {
  mapController.createEdge(req, res);
});

// DELETE /map/edge/:edgeId - Delete an edge
router.delete('/edge/:edgeId', (req, res) => {
  mapController.deleteEdge(req, res);
});

// POST /map/save - Save map data (anonymous or authenticated)
router.post('/save', (req, res) => {
  mapController.saveMap(req, res);
});

// GET /map/saved - Get user's saved maps
router.get('/saved', authenticate, (req, res) => {
  mapController.getSavedMaps(req, res);
});

// GET /map/saved/:mapId - Get a specific saved map
router.get('/saved/:mapId', authenticate, (req, res) => {
  mapController.getSavedMap(req, res);
});

// PUT /map/saved/:mapId - Update a saved map
router.put('/saved/:mapId', authenticate, (req, res) => {
  mapController.updateSavedMap(req, res);
});

// DELETE /map/saved/:mapId - Delete a saved map
router.delete('/saved/:mapId', authenticate, (req, res) => {
  mapController.deleteSavedMap(req, res);
});

// POST /map/sync - Sync map with assets
router.post('/sync', (req, res) => {
  mapController.syncWithAssets(req, res);
});

export default router;

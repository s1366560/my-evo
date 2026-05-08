import { Router } from 'express';
import { a2aController } from '../controllers/a2aController.js';
import { assetController } from '../controllers/assetController.js';
import { memoryController } from '../controllers/memoryController.js';
import { authenticate, optionalAuth, authenticateNode } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { 
  a2aHelloSchema, 
  a2aHeartbeatSchema, 
  assetPublishSchema, 
  assetFetchSchema,
  memoryStoreSchema,
} from '../models/schemas.js';

const router = Router();

// Asset routes (used by frontend hooks)
router.get('/assets/my', authenticate, (req, res) => {
  assetController.myAssets(req, res);
});

// Node Registration & Management
// POST /a2a/hello - Register a new node
router.post('/hello', validateBody(a2aHelloSchema), (req, res) => {
  a2aController.hello(req, res);
});

// POST /a2a/heartbeat - Node heartbeat
router.post('/heartbeat', validateBody(a2aHeartbeatSchema), (req, res) => {
  a2aController.heartbeat(req, res);
});

// GET /a2a/nodes - List nodes
router.get('/nodes', (req, res) => {
  a2aController.listNodes(req, res);
});

// GET /a2a/node/:nodeId - Get node details
router.get('/node/:nodeId', (req, res) => {
  a2aController.getNode(req, res);
});

// POST /a2a/node/verify - Verify/activate node (admin)
router.post('/node/verify', authenticate, (req, res) => {
  a2aController.verifyNode(req, res);
});

// Asset Publishing & Fetching
// POST /a2a/publish - Publish an asset (node auth required)
router.post('/publish', authenticateNode, validateBody(assetPublishSchema), (req, res) => {
  assetController.publish(req, res);
});

// POST /a2a/fetch - Search assets
router.post('/fetch', validateBody(assetFetchSchema), (req, res) => {
  assetController.fetch(req, res);
});

// GET /a2a/asset/:assetId - Get asset details
router.get('/asset/:assetId', (req, res) => {
  assetController.getAsset(req, res);
});

// POST /a2a/asset/:assetId/review - Submit review (user auth required)
router.post('/asset/:assetId/review', authenticate, (req, res) => {
  assetController.reviewAsset(req, res);
});

// Memory System
// POST /a2a/memory - Store a memory
router.post('/memory', authenticateNode, validateBody(memoryStoreSchema), (req, res) => {
  memoryController.store(req, res);
});

// POST /a2a/memory/record - Store a memory (alias for /memory)
router.post('/memory/record', authenticateNode, (req, res) => {
  memoryController.store(req, res);
});

// POST /a2a/memory/recall - Recall memories
router.post('/memory/recall', (req, res) => {
  memoryController.recall(req, res);
});

// GET /a2a/memory/status - Get memory status
router.get('/memory/status', (req, res) => {
  memoryController.getStatus(req, res);
});

// GET /a2a/memory/list - List memories for a node (query param: agentId)
router.get('/memory/list', (req, res) => {
  memoryController.getNodeMemories(req, res);
});

// GET /a2a/memory/node/:nodeId - Get node memories (alias)
router.get('/memory/node/:nodeId', (req, res) => {
  memoryController.getNodeMemories(req, res);
});

// DELETE /a2a/memory/:memoryId - Delete memory
router.delete('/memory/:memoryId', authenticateNode, (req, res) => {
  memoryController.delete(req, res);
});

// DELETE /a2a/memory - Delete memory (alternative with body)
router.delete('/memory', authenticateNode, (req, res) => {
  const { id } = req.body;
  if (id) {
    req.params.memoryId = id.toString();
  }
  memoryController.delete(req, res);
});

export default router;

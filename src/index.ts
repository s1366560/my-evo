/**
 * EvoMap Hub - A2A Protocol Server
 * 
 * This is a partial implementation of the EvoMap.ai clone
 * focusing on node registration and heartbeat functionality.
 */

import express, { Request, Response, NextFunction } from 'express';
import { registerNode, validateNodeSecret, getNodeInfo, HUB_NODE_ID } from './a2a/node';
import { processHeartbeat } from './a2a/heartbeat';
import { HelloPayload, HeartbeatPayload } from './a2a/types';

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', hub_id: HUB_NODE_ID });
});

// ==================== A2A Endpoints ====================

/**
 * POST /a2a/hello
 * Register a node and get node_secret
 */
app.post('/a2a/hello', async (req: Request, res: Response) => {
  try {
    const payload = req.body as HelloPayload;
    
    // Validate required fields
    if (!payload) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing payload body'
      });
      return;
    }

    const result = await registerNode(payload);
    res.json(result);
  } catch (error) {
    console.error('Hello error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /a2a/heartbeat
 * Keep node alive and receive events/tasks
 */
app.post('/a2a/heartbeat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const payload = req.body as HeartbeatPayload;

    if (!payload.sender_id) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing sender_id in payload'
      });
      return;
    }

    const result = await processHeartbeat(authHeader, payload);
    res.json(result);
  } catch (error) {
    console.error('Heartbeat error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        res.status(401).json({
          error: 'unauthorized',
          message: error.message
        });
        return;
      }
    }
    
    res.status(500).json({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /a2a/nodes
 * List all registered nodes
 */
app.get('/a2a/nodes', (_req: Request, res: Response) => {
  const { getAllNodes } = require('./a2a/node');
  const nodes = getAllNodes();
  res.json({ nodes, count: nodes.length });
});

/**
 * GET /a2a/nodes/:id
 * Get specific node info
 */
app.get('/a2a/nodes/:id', (req: Request, res: Response) => {
  const nodeId = req.params.id;
  const node = getNodeInfo(nodeId);
  
  if (!node) {
    res.status(404).json({
      error: 'node_not_found',
      message: `Node ${nodeId} not found`
    });
    return;
  }
  
  res.json(node);
});

// ==================== Placeholder Endpoints ====================

/**
 * POST /a2a/publish
 * Placeholder - to be implemented
 */
app.post('/a2a/publish', (req: Request, res: Response) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Asset publishing not yet implemented',
    correction: 'This endpoint will be implemented in Phase 2'
  });
});

/**
 * POST /a2a/fetch
 * Placeholder - to be implemented
 */
app.post('/a2a/fetch', (req: Request, res: Response) => {
  res.status(501).json({
    error: 'not_implemented',
    message: 'Asset fetching not yet implemented',
    correction: 'This endpoint will be implemented in Phase 2'
  });
});

// ==================== Error Handling ====================

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found'
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_error',
    message: 'An unexpected error occurred'
  });
});

// ==================== Start Server ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    EvoMap Hub Server                       ║
╠═══════════════════════════════════════════════════════════╣
║  Status: Running                                           ║
║  Hub ID: ${HUB_NODE_ID.padEnd(45)}║
║  Port:   ${PORT.toString().padEnd(45)}║
║                                                           ║
║  Endpoints:                                                ║
║  - POST /a2a/hello      (node registration)               ║
║  - POST /a2a/heartbeat  (keep-alive)                     ║
║  - GET  /a2a/nodes     (list nodes)                      ║
║  - GET  /a2a/nodes/:id  (node info)                      ║
║                                                           ║
║  Heartbeat: 15 min | Offline after: 45 min               ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;

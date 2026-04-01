import { Router, Request, Response } from 'express';
import { registerNode, validateNodeSecret, getNodeInfo, getNodeActivity, getAllNodes } from './node';
import { processHeartbeat, getPendingEvents, clearPendingEvents } from './heartbeat';
import { HelloPayload, HeartbeatPayload } from './types';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getCreditBalance, initializeCreditBalance } from '../reputation/engine';
import { getDailyDiscovery } from '../assets/fetch';

const router = Router();

/**
 * POST /a2a/hello
 * Register a node and get node_secret
 */
router.post('/hello', async (req: Request, res: Response) => {
  try {
    const payload = req.body as HelloPayload;

    if (!payload) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing payload body' });
      return;
    }

    const result = await registerNode(payload);

    if (result.status === 'acknowledged' || result.status === 'ok') {
      const nodeId = result.your_node_id;
      if (nodeId && !getCreditBalance(nodeId)) {
        initializeCreditBalance(nodeId);
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Hello error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * POST /a2a/heartbeat
 * Keep node alive and receive events/tasks
 */
router.post('/heartbeat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const payload = req.body as HeartbeatPayload;

    if (!payload.sender_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing sender_id in payload' });
      return;
    }

    const result = await processHeartbeat(authHeader, payload);
    res.json(result);
  } catch (error) {
    console.error('Heartbeat error:', error);

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      res.status(401).json({ error: 'unauthorized', message: error.message });
      return;
    }

    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/events/poll
 * Long-poll for events (waits up to 30s if no events available)
 */
router.get('/events/poll', requireAuth, (req: Request, res: Response) => {
  const nodeId = (req as AuthRequest).nodeId;
  const { timeout = '30000' } = req.query;
  const timeoutMs = Math.min(parseInt(timeout as string) || 30000, 30000);

  let events = getPendingEvents(nodeId);
  if (events.length > 0) {
    clearPendingEvents(nodeId);
    res.json({ events, count: events.length });
    return;
  }

  const pollInterval = 1000;
  let waited = 0;

  const interval = setInterval(() => {
    events = getPendingEvents(nodeId);
    if (events.length > 0 || waited >= timeoutMs) {
      clearInterval(interval);
      clearPendingEvents(nodeId);
      res.json({ events, count: events.length, waited_ms: waited });
    }
    waited += pollInterval;
  }, pollInterval);

  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * GET /a2a/nodes
 * List all registered nodes
 */
router.get('/nodes', (_req: Request, res: Response) => {
  const nodes = getAllNodes();
  res.json({ nodes, count: nodes.length });
});

/**
 * GET /a2a/nodes/:id
 * Get specific node info
 */
router.get('/nodes/:id', (req: Request, res: Response) => {
  const nodeId = req.params.id;
  const node = getNodeInfo(nodeId);

  if (!node) {
    res.status(404).json({ error: 'node_not_found', message: `Node ${nodeId} not found` });
    return;
  }
  res.json(node);
});

/**
 * GET /a2a/nodes/:nodeId/activity
 * Get node activity summary
 */
router.get('/nodes/:nodeId/activity', (req: Request, res: Response) => {
  try {
    const activity = getNodeActivity(req.params.nodeId);
    if (!activity.node) {
      res.status(404).json({ error: 'node_not_found', message: `Node ${req.params.nodeId} not found` });
      return;
    }
    res.json(activity);
  } catch (error) {
    console.error('Node activity error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * GET /a2a/lessons
 * Curated lessons from high-value evolution events
 */
router.get('/lessons', (_req: Request, res: Response) => {
  try {
    const assets = getDailyDiscovery({ limit: 10 });
    const lessons = assets.map((a: any) => ({
      id: a.asset_id,
      title: a.summary ?? 'Untitled',
      signal: a.type === 'Gene' ? a.signals_match?.[0] : a.trigger?.[0],
      type: a.type,
      confidence: a.confidence,
      gdi: a.gdi?.total,
      published_at: a.created_at,
    }));
    res.json({ lessons, total: lessons.length });
  } catch (error) {
    console.error('Lessons error:', error);
    res.status(500).json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

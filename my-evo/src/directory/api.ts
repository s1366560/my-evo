import { Router, Request, Response } from 'express';
import * as directory from './index';

const router = Router();

// GET /a2a/directory
router.get('/', (req: Request, res: Response) => {
  try {
    const { q, capabilities, min_reputation, limit } = req.query;
    const result = directory.searchAgents({
      q: q as string,
      capabilities: capabilities ? (capabilities as string).split(',') : undefined,
      min_reputation: min_reputation ? parseFloat(min_reputation as string) : undefined,
      limit: limit ? parseInt(limit as string) : 20,
    });
    res.json(result);
  } catch (error) {
    console.error('Directory error:', error);
    res.status(500).json({ error: 'search_failed', message: String(error) });
  }
});

// GET /a2a/directory/stats
router.get('/stats', (_req: Request, res: Response) => {
  res.json(directory.getDirectoryStats());
});

// GET /a2a/agents/:id
router.get('/agents/:id', (req: Request, res: Response) => {
  const agent = directory.getAgent(req.params.id);
  if (!agent) {
    res.status(404).json({ error: 'agent_not_found' });
    return;
  }
  res.json(agent);
});

// POST /a2a/dm
router.post('/dm', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const { recipient_id, content } = req.body;
    if (!recipient_id || !content) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }
    const msg = directory.sendDirectMessage(auth.slice(7), recipient_id, content);
    res.status(201).json({ message_id: msg.id, status: 'sent' });
  } catch (error) {
    res.status(500).json({ error: 'send_failed', message: String(error) });
  }
});

// GET /a2a/dm/inbox
router.get('/dm/inbox', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = auth.slice(7);
    res.json({ messages: directory.getInbox(nodeId), unread: directory.getUnreadCount(nodeId) });
  } catch (error) {
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// GET /a2a/dm/sent
router.get('/dm/sent', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ messages: directory.getSentMessages(auth.slice(7)) });
  } catch (error) {
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// POST /a2a/dm/read-all
router.post('/dm/read-all', (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    res.json({ marked: directory.markAllAsRead(auth.slice(7)) });
  } catch (error) {
    res.status(500).json({ error: 'update_failed' });
  }
});

export default router;

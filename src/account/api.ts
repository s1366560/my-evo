import { Router, Request, Response } from 'express';
import * as apiKeys from './api-keys';
import { requireSessionAuth, SessionRequest } from '../middleware/auth';

const router = Router();

// POST /account/api-keys
router.post('/api-keys', requireSessionAuth, (req: Request, res: Response) => {
  const userId = (req as SessionRequest).userId;
  const { name, scopes, expires_in_days } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'validation_error', message: 'name is required and must be a string', docs: '/account/api-keys' });
    return;
  }

  const stats = apiKeys.getAccountStats(userId);
  if (stats.active_keys >= stats.max_keys) {
    res.status(403).json({
      error: 'limit_exceeded',
      message: `Maximum of ${stats.max_keys} active API keys exceeded. Revoke an existing key before creating a new one.`,
    });
    return;
  }

  const key = apiKeys.createApiKey({ name, scopes: scopes ?? ['kg'], expires_in_days, user_id: userId });

  res.status(201).json({
    id: key.id,
    key: key.key,
    prefix: key.prefix,
    name: key.name,
    scopes: key.scopes,
    expires_at: key.expires_at,
    created_at: key.created_at,
  });
});

// GET /account/api-keys
router.get('/api-keys', requireSessionAuth, (req: Request, res: Response) => {
  const userId = (req as SessionRequest).userId;
  const keys = apiKeys.listApiKeys(userId);
  res.json({ keys, count: keys.length });
});

// DELETE /account/api-keys/:id
router.delete('/api-keys/:id', requireSessionAuth, (req: Request, res: Response) => {
  const userId = (req as SessionRequest).userId;
  const revoked = apiKeys.revokeApiKey(req.params.id, userId);
  if (!revoked) {
    res.status(404).json({ error: 'not_found', message: 'API key not found or not owned by you' });
    return;
  }
  res.json({ success: true });
});

export default router;

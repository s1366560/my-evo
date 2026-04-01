/**
 * Community Evolution API Endpoints
 * Guilds, Circles, and Novelty tracking
 * 
 * Endpoints:
 * - GET /a2a/community/evolution/guilds - List guilds
 * - POST /a2a/community/evolution/guilds - Create a guild
 * - GET /a2a/community/evolution/guilds/:id - Guild details
 * - POST /a2a/community/evolution/guilds/:id/join - Join a guild
 * - POST /a2a/community/evolution/guilds/:id/leave - Leave a guild
 * - GET /a2a/community/evolution/circles - List circles
 * - GET /a2a/community/evolution/circles/:id - Circle details
 * - GET /a2a/community/evolution/novelty/:nodeId - Novelty score
 */

import { Router } from 'express';
import { validateNodeSecret } from '../a2a/node';
import {
  listGuilds,
  getGuild,
  createGuild,
  getGuildMembers,
  joinGuild,
  leaveGuild,
  listCircles,
  getCircle,
  getNoveltyScore,
  updateNoveltyScore,
} from './engine';

const router = Router();

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization header' });
  }
  const nodeId = validateNodeSecret(auth.slice(7));
  if (!nodeId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
  }
  req.nodeId = nodeId;
  next();
}

// GET /a2a/community/evolution/guilds - List guilds
router.get('/guilds', (_req: any, res: any) => {
  const guilds = listGuilds();
  res.json({ guilds, total: guilds.length });
});

// POST /a2a/community/evolution/guilds - Create a guild
router.post('/guilds', requireAuth, (req: any, res: any) => {
  const { name, description } = req.body;
  
  if (!name || name.length < 3) {
    return res.status(400).json({ error: 'invalid_request', message: 'Guild name must be at least 3 characters' });
  }
  
  const guild = createGuild(name, description || '', req.nodeId);
  res.json({ status: 'created', guild });
});

// GET /a2a/community/evolution/guilds/:id - Guild details
router.get('/guilds/:id', (req: any, res: any) => {
  const guild = getGuild(req.params.id);
  
  if (!guild) {
    return res.status(404).json({ error: 'not_found', message: 'Guild not found' });
  }
  
  const members = getGuildMembers(req.params.id);
  res.json({ guild, members, member_count: members.length });
});

// POST /a2a/community/evolution/guilds/:id/join - Join a guild
router.post('/guilds/:id/join', requireAuth, (req: any, res: any) => {
  const guild = getGuild(req.params.id);
  
  if (!guild) {
    return res.status(404).json({ error: 'not_found', message: 'Guild not found' });
  }
  
  const result = joinGuild(req.params.id, req.nodeId);
  
  if (!result.success) {
    return res.status(400).json({ error: 'join_failed', message: result.message });
  }
  
  res.json({ status: 'joined', message: result.message });
});

// POST /a2a/community/evolution/guilds/:id/leave - Leave a guild
router.post('/guilds/:id/leave', requireAuth, (req: any, res: any) => {
  const guild = getGuild(req.params.id);
  
  if (!guild) {
    return res.status(404).json({ error: 'not_found', message: 'Guild not found' });
  }
  
  const result = leaveGuild(req.params.id, req.nodeId);
  
  if (!result.success) {
    return res.status(400).json({ error: 'leave_failed', message: result.message });
  }
  
  res.json({ status: 'left', message: result.message });
});

// GET /a2a/community/evolution/circles - List circles
router.get('/circles', (_req: any, res: any) => {
  const circles = listCircles();
  res.json({ circles, total: circles.length });
});

// GET /a2a/community/evolution/circles/:id - Circle details
router.get('/circles/:id', (req: any, res: any) => {
  const circle = getCircle(req.params.id);
  
  if (!circle) {
    return res.status(404).json({ error: 'not_found', message: 'Circle not found' });
  }
  
  res.json({ circle });
});

// GET /a2a/community/evolution/novelty/:nodeId - Get novelty score
router.get('/novelty/:nodeId', (req: any, res: any) => {
  let score = getNoveltyScore(req.params.nodeId);
  
  // If not found, calculate and store it
  if (!score) {
    score = updateNoveltyScore(req.params.nodeId);
  }
  
  res.json({ novelty: score });
});

export default router;

import { Request, Response, NextFunction } from 'express';
import { validateNodeSecret } from '../a2a/node';
import { validateSession } from '../account/api-keys';

export interface AuthRequest extends Request {
  nodeId: string;
}

export interface SessionRequest extends Request {
  userId: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  const nodeId = validateNodeSecret(token);
  if (!nodeId) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
    return;
  }
  (req as AuthRequest).nodeId = nodeId;
  next();
}

export function requireSessionAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  const userId = validateSession(token);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session token' });
    return;
  }
  (req as SessionRequest).userId = userId;
  next();
}

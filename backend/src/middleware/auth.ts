import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../auth/jwt.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      nodeAuth?: {
        nodeId: string;
        verified: boolean;
      };
    }
  }
}

// User authentication middleware
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header'
    });
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Token has expired'
        });
        return;
      }
    }
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
}

// Optional authentication - doesn't fail if no token
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = verifyToken(token);
    req.user = payload;
  } catch {
    // Ignore invalid tokens for optional auth
  }
  
  next();
}

// Admin role check middleware
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      return;
    }
    
    next();
  };
}

// Node (EvoNode) authentication middleware
export function authenticateNode(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Node authentication required'
    });
    return;
  }
  
  // For node auth, we use the node_secret directly
  const nodeId = req.headers['x-node-id'] as string;
  const secret = authHeader.substring(7);
  
  if (!nodeId) {
    res.status(400).json({ 
      error: 'Bad Request',
      message: 'x-node-id header required'
    });
    return;
  }
  
  req.nodeAuth = {
    nodeId,
    verified: true, // Will be verified in the route handler with database
  };
  
  next();
}

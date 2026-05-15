import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma.js';

function generateNodeId(): string {
  const hash = crypto.createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 12);
  return `node_${hash}`;
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class A2AController {
  // POST /a2a/hello - Register a new node
  async hello(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, capabilities, version, endpoint } = req.body;

      // Check max nodes per user (if authenticated)
      if (req.user) {
        const nodeCount = await prisma.node.count({
          where: { userId: req.user.userId },
        });
        const maxNodes = 10; // could come from config
        if (nodeCount >= maxNodes) {
          res.status(400).json({
            error: 'Bad Request',
            message: `Maximum number of nodes (${maxNodes}) reached for this user`,
          });
          return;
        }
      }

      const nodeId = generateNodeId();
      const secret = generateSecret();

      // Hash the secret for storage
      const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

      const node = await prisma.node.create({
        data: {
          nodeId,
          secret: secretHash,
          name,
          description: description || '',
          capabilities: JSON.stringify(capabilities || []),
          version: version || null,
          endpoint: endpoint || null,
          status: 'ACTIVE',
          userId: req.user?.userId || null,
        },
      });

      res.status(201).json({
        node_id: node.nodeId,
        secret, // Return plain secret ONLY on creation
        name: node.name,
        status: node.status,
        message: 'Node registered successfully. Store the secret securely — it will not be shown again.',
      });
    } catch (error) {
      console.error('A2A hello error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to register node',
      });
    }
  }

  // POST /a2a/heartbeat - Node heartbeat
  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId, status, load, activeTasks } = req.body;

      const node = await prisma.node.findUnique({
        where: { nodeId },
      });

      if (!node) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Node not found',
        });
        return;
      }

      // Update node status and lastSeen
      await prisma.node.update({
        where: { nodeId },
        data: {
          status: status || 'ACTIVE',
          lastSeenAt: new Date(),
        },
      });

      // Log heartbeat
      await prisma.heartbeatLog.create({
        data: {
          nodeId: node.id,
          status: status || 'ACTIVE',
          load: load || null,
          activeTasks: activeTasks || null,
        },
      });

      res.json({
        node_id: nodeId,
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('A2A heartbeat error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process heartbeat',
      });
    }
  }

  // GET /a2a/nodes - List nodes
  async listNodes(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const nodes = await prisma.node.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        select: {
          nodeId: true,
          name: true,
          description: true,
          status: true,
          reputation: true,
          level: true,
          version: true,
          lastSeenAt: true,
          createdAt: true,
        },
      });

      res.json({ nodes, count: nodes.length });
    } catch (error) {
      console.error('List nodes error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to list nodes' });
    }
  }

  // GET /a2a/node/:nodeId - Get node details
  async getNode(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;

      const node = await prisma.node.findUnique({
        where: { nodeId },
        select: {
          nodeId: true,
          name: true,
          description: true,
          capabilities: true,
          status: true,
          reputation: true,
          level: true,
          credits: true,
          version: true,
          endpoint: true,
          lastSeenAt: true,
          createdAt: true,
          user: {
            select: { username: true },
          },
        },
      });

      if (!node) {
        res.status(404).json({ error: 'Not Found', message: 'Node not found' });
        return;
      }

      res.json({
        node: {
          ...node,
          capabilities: node.capabilities ? JSON.parse(node.capabilities) : [],
        },
      });
    } catch (error) {
      console.error('Get node error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get node' });
    }
  }

  // POST /a2a/node/verify - Verify/activate node (admin)
  async verifyNode(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
        return;
      }

      const { nodeId, action } = req.body;

      const node = await prisma.node.findUnique({ where: { nodeId } });
      if (!node) {
        res.status(404).json({ error: 'Not Found', message: 'Node not found' });
        return;
      }

      let newStatus: string;
      switch (action) {
        case 'deactivate': newStatus = 'INACTIVE'; break;
        case 'block': newStatus = 'BLOCKED'; break;
        default: newStatus = 'ACTIVE';
      }

      const updated = await prisma.node.update({
        where: { nodeId },
        data: { status: newStatus },
      });

      res.json({
        node_id: nodeId,
        status: updated.status,
        message: `Node ${action || 'activated'} successfully`,
      });
    } catch (error) {
      console.error('Verify node error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to verify node' });
    }
  }
}

export const a2aController = new A2AController();

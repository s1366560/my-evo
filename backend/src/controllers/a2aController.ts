import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma.js';
import { signNodeToken } from '../auth/jwt.js';
import { A2AHelloInput, A2AHeartbeatInput } from '../models/schemas.js';

function generateNodeId(): string {
  const hash = crypto.createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 16);
  return `node_${hash}`;
}

function generateNodeSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class A2AController {
  // POST /a2a/hello - Node registration
  async hello(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, capabilities, version, endpoint } = req.body as A2AHelloInput;
      
      // Generate node credentials
      const nodeId = generateNodeId();
      const secret = generateNodeSecret();
      const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
      
      // Create node record
      const node = await prisma.node.create({
        data: {
          nodeId,
          secret: secretHash,
          name,
          description,
          capabilities: JSON.stringify(capabilities),
          version,
          endpoint,
          status: 'PENDING', // Start as pending for review
          userId: req.user?.userId, // Associate with user if authenticated
        },
      });
      
      res.status(201).json({
        node_id: node.nodeId,
        secret: secret, // Return plain secret only once
        status: 'pending',
        hub_url: `/a2a/node/${node.nodeId}`,
        message: 'Node registered successfully. Complete verification to activate.',
      });
    } catch (error) {
      console.error('A2A Hello error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to register node',
      });
    }
  }
  
  // POST /a2a/heartbeat - Node heartbeat
  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const { node_id, status, active_tasks, load } = req.body as A2AHeartbeatInput;
      
      // Verify node exists
      const node = await prisma.node.findUnique({
        where: { nodeId: node_id },
      });
      
      if (!node) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Node not found',
        });
        return;
      }
      
      // Update node status and last seen
      await prisma.node.update({
        where: { nodeId: node_id },
        data: {
          status: status === 'active' ? 'ACTIVE' : 
                  status === 'busy' ? 'ACTIVE' : 'ACTIVE',
          lastSeenAt: new Date(),
        },
      });
      
      // Log heartbeat
      await prisma.heartbeatLog.create({
        data: {
          nodeId: node.id,
          status,
          load: load ?? null,
          activeTasks: active_tasks?.length ?? null,
        },
      });
      
      res.json({
        ok: true,
        server_time: new Date().toISOString(),
        node_status: node.status,
      });
    } catch (error) {
      console.error('A2A Heartbeat error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process heartbeat',
      });
    }
  }
  
  // POST /a2a/node/verify - Verify and activate node (admin)
  async verifyNode(req: Request, res: Response): Promise<void> {
    try {
      const { node_id, activate } = req.body;
      
      const node = await prisma.node.findUnique({
        where: { nodeId: node_id },
      });
      
      if (!node) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Node not found',
        });
        return;
      }
      
      const newStatus = activate ? 'ACTIVE' : 'BLOCKED';
      
      await prisma.node.update({
        where: { nodeId: node_id },
        data: { status: newStatus },
      });
      
      res.json({
        node_id,
        status: newStatus.toLowerCase(),
        message: activate ? 'Node activated' : 'Node blocked',
      });
    } catch (error) {
      console.error('Node verify error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update node status',
      });
    }
  }
  
  // GET /a2a/nodes - List nodes (public info)
  async listNodes(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      
      const where = status ? { status: status as string } : {};
      
      const nodesRaw = await prisma.node.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        select: {
          nodeId: true,
          name: true,
          description: true,
          capabilities: true,
          version: true,
          status: true,
          reputation: true,
          level: true,
          createdAt: true,
          lastSeenAt: true,
        },
      });
      
      // Parse JSON fields
      const nodes = nodesRaw.map(n => ({
        ...n,
        capabilities: JSON.parse(n.capabilities),
      }));
      
      const total = await prisma.node.count({ where });
      
      res.json({
        nodes,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      console.error('List nodes error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list nodes',
      });
    }
  }
  
  // GET /a2a/node/:nodeId - Get node details
  async getNode(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      
      const nodeRaw = await prisma.node.findUnique({
        where: { nodeId },
        select: {
          nodeId: true,
          name: true,
          description: true,
          capabilities: true,
          version: true,
          endpoint: true,
          status: true,
          reputation: true,
          level: true,
          credits: true,
          createdAt: true,
          lastSeenAt: true,
          _count: {
            select: {
              assets: true,
            },
          },
        },
      });
      
      if (!nodeRaw) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Node not found',
        });
        return;
      }
      
      const node = {
        ...nodeRaw,
        capabilities: JSON.parse(nodeRaw.capabilities),
      };
      
      if (!node) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Node not found',
        });
        return;
      }
      
      res.json({ node });
    } catch (error) {
      console.error('Get node error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get node',
      });
    }
  }
}

export const a2aController = new A2AController();

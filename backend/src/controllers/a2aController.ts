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

// Starter gene pack - curated list of fundamental genes for new nodes
const STARTER_GENE_PACK = [
  {
    name: 'JWT Signature Validation',
    type: 'gene',
    description: 'Validates JWT token signatures using cryptographic verification',
    tags: ['security', 'jwt', 'validation'],
    tools: ['jwt_validate'],
    confidence: 0.95,
  },
  {
    name: 'HTTP Request Handler',
    type: 'gene',
    description: 'Standardized HTTP request processing and response handling',
    tags: ['http', 'api', 'network'],
    tools: ['http_request'],
    confidence: 0.92,
  },
  {
    name: 'JSON Schema Validator',
    type: 'gene',
    description: 'Validates JSON payloads against JSON Schema specifications',
    tags: ['validation', 'json', 'schema'],
    tools: ['validate_json_schema'],
    confidence: 0.90,
  },
  {
    name: 'Markdown Renderer',
    type: 'gene',
    description: 'Renders markdown content to HTML with syntax highlighting',
    tags: ['markdown', 'rendering', 'ui'],
    tools: ['render_markdown'],
    confidence: 0.88,
  },
  {
    name: 'Base64 Encoder/Decoder',
    type: 'gene',
    description: 'Encodes and decodes data using Base64 format',
    tags: ['encoding', 'utility', 'data'],
    tools: ['base64_encode', 'base64_decode'],
    confidence: 0.93,
  },
];

function generateClaimCode(): string {
  // Generate format: EVOO-XXXX (4 alphanumeric chars)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'EVOO-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
      const claimCode = generateClaimCode();

      // Get base URL from config or use default
      const baseUrl = process.env.API_BASE_URL || 'https://evomap.ai';
      const claimUrl = `${baseUrl}/claim/${claimCode}`;

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
        claim_url: claimUrl,
        claim_code: claimCode,
        starter_gene_pack: STARTER_GENE_PACK,
        credit_balance: node.credits,
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

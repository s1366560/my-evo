import { Request, Response } from 'express';
import prisma from '../db/prisma.js';
import { MemoryStoreInput } from '../models/schemas.js';

export class MemoryController {
  // POST /a2a/memory - Store a memory
  async store(req: Request, res: Response): Promise<void> {
    try {
      const nodeId = req.headers['x-node-id'] as string;
      
      if (!nodeId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'x-node-id header required',
        });
        return;
      }
      
      const { type, content, embedding, metadata } = req.body as MemoryStoreInput;
      
      // Verify node exists
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
      
      // Create memory record
      const memory = await prisma.memory.create({
        data: {
          nodeId,
          type: type.toUpperCase(),
          content,
          embedding: JSON.stringify(embedding || []),
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
      
      res.status(201).json({
        memory_id: memory.id,
        type: memory.type.toLowerCase(),
        message: 'Memory stored successfully',
      });
    } catch (error) {
      console.error('Memory store error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to store memory',
      });
    }
  }
  
  // POST /a2a/memory/recall - Recall memories
  async recall(req: Request, res: Response): Promise<void> {
    try {
      const { query, type, limit = 10 } = req.body;
      
      // Simplified recall - in production would use vector similarity search
      const where: Record<string, unknown> = {};
      
      if (type) {
        where.type = type.toUpperCase();
      }
      
      if (query) {
        where.content = { contains: query };
      }
      
      const memoriesRaw = await prisma.memory.findMany({
        where,
        take: Number(limit),
        orderBy: { accessedAt: 'desc' },
      });
      
      // Parse JSON fields
      const memories = memoriesRaw.map(m => ({
        ...m,
        embedding: JSON.parse(m.embedding),
        metadata: m.metadata ? JSON.parse(m.metadata) : null,
      }));
      
      // Update access time
      await prisma.memory.updateMany({
        where: {
          id: { in: memories.map(m => m.id) },
        },
        data: {
          accessedAt: new Date(),
        },
      });
      
      res.json({
        memories,
        count: memories.length,
      });
    } catch (error) {
      console.error('Memory recall error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to recall memories',
      });
    }
  }
  
  // GET /a2a/memory/node/:nodeId - Get memories for a node
  async getNodeMemories(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { type, limit = 50, offset = 0 } = req.query;
      
      const where: Record<string, unknown> = { nodeId };
      
      if (type) {
        where.type = (type as string).toUpperCase();
      }
      
      const memoriesRaw = await prisma.memory.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
      });
      
      // Parse JSON fields
      const memories = memoriesRaw.map(m => ({
        ...m,
        embedding: JSON.parse(m.embedding),
        metadata: m.metadata ? JSON.parse(m.metadata) : null,
      }));
      
      const total = await prisma.memory.count({ where });
      
      res.json({
        memories,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      console.error('Get node memories error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get memories',
      });
    }
  }
  
  // DELETE /a2a/memory/:memoryId - Delete a memory
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const nodeId = req.headers['x-node-id'] as string;
      const { memoryId } = req.params;
      
      if (!nodeId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'x-node-id header required',
        });
        return;
      }
      
      // Verify ownership
      const memory = await prisma.memory.findUnique({
        where: { id: memoryId },
      });
      
      if (!memory) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Memory not found',
        });
        return;
      }
      
      if (memory.nodeId !== nodeId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Cannot delete memory from another node',
        });
        return;
      }
      
      await prisma.memory.delete({
        where: { id: memoryId },
      });
      
      res.json({
        message: 'Memory deleted successfully',
      });
    } catch (error) {
      console.error('Delete memory error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete memory',
      });
    }
  }

  // GET /a2a/memory/status - Get memory status for a node
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const agentId = req.query.agentId as string;
      const nodeId = req.headers['x-node-id'] as string;
      const targetNodeId = agentId || nodeId;

      if (!targetNodeId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'agentId query param or x-node-id header required',
        });
        return;
      }

      const [totalMemories, lastMemory, memoriesByType] = await Promise.all([
        prisma.memory.count({ where: { nodeId: targetNodeId } }),
        prisma.memory.findFirst({
          where: { nodeId: targetNodeId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.memory.groupBy({
          by: ['type'],
          where: { nodeId: targetNodeId },
          _count: true,
        }),
      ]);

      // Calculate storage usage (approximate)
      const allMemories = await prisma.memory.findMany({
        where: { nodeId: targetNodeId },
        select: { content: true, metadata: true, embedding: true },
      });

      let storageUsage = 0;
      for (const m of allMemories) {
        storageUsage += Buffer.byteLength(m.content, 'utf8');
        if (m.metadata) storageUsage += Buffer.byteLength(m.metadata, 'utf8');
        if (m.embedding) storageUsage += Buffer.byteLength(m.embedding, 'utf8');
      }

      res.json({
        totalMemories,
        storageUsage,
        lastRecall: lastMemory?.accessedAt?.toISOString() || null,
        lastMemory: lastMemory?.createdAt?.toISOString() || null,
        signalCount: memoriesByType.reduce((acc, curr) => acc + curr._count, 0),
        memoryTypes: memoriesByType.reduce((acc, curr) => {
          acc[curr.type.toLowerCase()] = curr._count;
          return acc;
        }, {} as Record<string, number>),
      });
    } catch (error) {
      console.error('Get memory status error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get memory status',
      });
    }
  }
}

export const memoryController = new MemoryController();

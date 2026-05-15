import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma.js';
import { gdiScoringService } from '../services/gdiScoringService.js';

function generateAssetId(type: string): string {
  const prefix = type === 'GENE' ? 'gene' : 'capsule';
  const hash = crypto.createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 12);
  return `${prefix}_${hash}`;
}

export class AssetController {
  // GET /a2a/asset/:assetId
  async getAsset(req: Request, res: Response): Promise<void> {
    try {
      const { assetId } = req.params;
      const asset = await prisma.asset.findUnique({
        where: { assetId },
        include: {
          node: { select: { nodeId: true, name: true, reputation: true } },
          user: { select: { username: true } },
          reviews: {
            select: { rating: true, comment: true, createdAt: true, user: { select: { username: true } } },
            orderBy: { createdAt: 'desc' }, take: 10,
          },
          _count: { select: { reviews: true } },
        },
      });
      if (!asset) { res.status(404).json({ error: 'Not Found', message: 'Asset not found' }); return; }
      res.json({ asset: {
        ...asset,
        tools: asset.tools ? JSON.parse(asset.tools) : [],
        tags: asset.tags ? JSON.parse(asset.tags) : [],
        gdiBreakdown: asset.gdiBreakdown ? JSON.parse(asset.gdiBreakdown) : null,
      }});
    } catch (error) {
      console.error('Get asset error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get asset' });
    }
  }

  // POST /a2a/publish
  async publish(req: Request, res: Response): Promise<void> {
    try {
      const nodeId = req.nodeAuth?.nodeId;
      if (!nodeId) { res.status(401).json({ error: 'Unauthorized', message: 'Node auth required' }); return; }
      const node = await prisma.node.findUnique({ where: { nodeId } });
      if (!node) { res.status(404).json({ error: 'Not Found', message: 'Node not found' }); return; }

      const { type, name, description, content, tools, model, tags, license, parentId } = req.body;
      const assetId = generateAssetId(type);
      const scoreResult = await gdiScoringService.calculateScore({
        type, name, description: description || '', content: content || { dna: '', prompt: '', tools: tools || [] }, tags: tags || [],
      });

      const asset = await prisma.asset.create({
        data: {
          assetId, type, name, description: description || null,
          dna: content?.dna || null, prompt: content?.prompt || null,
          tools: JSON.stringify(tools || []), model: model || null,
          tags: JSON.stringify(tags || []), license: license || 'MIT',
          parentId: parentId || null, gdiScore: scoreResult.overall,
          gdiBreakdown: JSON.stringify(scoreResult),
          status: 'PUBLISHED', publishedAt: new Date(),
          nodeId: node.id, userId: node.userId,
        },
      });
      await prisma.node.update({ where: { id: node.id }, data: { reputation: { increment: 1 } } });
      res.status(201).json({ asset_id: asset.assetId, name: asset.name, type: asset.type, gdi_score: asset.gdiScore, status: asset.status, message: 'Asset published successfully' });
    } catch (error) {
      console.error('Asset publish error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to publish asset' });
    }
  }

  // POST /a2a/fetch
  async fetch(req: Request, res: Response): Promise<void> {
    try {
      const { query, type, tags, status = 'PUBLISHED', limit = 20, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = req.body;
      const where: Record<string, unknown> = {};
      if (type) where.type = type;
      if (status) where.status = status;
      if (query) where.OR = [{ name: { contains: query } }, { description: { contains: query } }];

      let assets = await prisma.asset.findMany({
        where, take: Number(limit), skip: Number(offset),
        orderBy: { [sortBy]: sortOrder },
        include: { node: { select: { nodeId: true, name: true } }, user: { select: { username: true } }, _count: { select: { reviews: true } } },
      });
      if (tags && tags.length > 0) {
        assets = assets.filter(asset => {
          const assetTags: string[] = asset.tags ? JSON.parse(asset.tags) : [];
          return tags.every((t: string) => assetTags.includes(t));
        });
      }
      res.json({ assets, count: assets.length });
    } catch (error) {
      console.error('Asset fetch error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch assets' });
    }
  }

  // GET /a2a/assets/my
  async myAssets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: 'Login required' }); return; }
      const assets = await prisma.asset.findMany({
        where: { userId: req.user.userId }, orderBy: { createdAt: 'desc' },
        select: { assetId: true, type: true, name: true, description: true, gdiScore: true, status: true, publishedAt: true, createdAt: true },
      });
      res.json({ assets, count: assets.length });
    } catch (error) {
      console.error('My assets error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get assets' });
    }
  }

  // POST /a2a/asset/:assetId/review
  async reviewAsset(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) { res.status(401).json({ error: 'Unauthorized', message: 'Login required' }); return; }
      const { assetId } = req.params;
      const { rating, comment } = req.body;
      const asset = await prisma.asset.findUnique({ where: { assetId } });
      if (!asset) { res.status(404).json({ error: 'Not Found', message: 'Asset not found' }); return; }

      const existing = await prisma.assetReview.findFirst({ where: { assetId: asset.id, userId: req.user.userId } });
      if (existing) {
        const updated = await prisma.assetReview.update({ where: { id: existing.id }, data: { rating, comment } });
        res.json({ review_id: updated.id, message: 'Review updated' }); return;
      }
      const review = await prisma.assetReview.create({ data: { assetId: asset.id, userId: req.user.userId, rating, comment } });
      res.status(201).json({ review_id: review.id, message: 'Review submitted' });
    } catch (error) {
      console.error('Review asset error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to review asset' });
    }
  }
}

export const assetController = new AssetController();

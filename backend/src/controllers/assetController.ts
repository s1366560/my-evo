import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma.js';
import { AssetPublishInput, AssetFetchInput } from '../models/schemas.js';
import { gdiScoringService } from '../services/gdiScoringService.js';

function generateAssetId(type: string): string {
  const prefix = type === 'gene' ? 'gene' : 'capsule';
  const hash = crypto.createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 16);
  return `${prefix}_${hash}`;
}

export class AssetController {
  // POST /a2a/publish - Publish an asset (gene or capsule)
  async publish(req: Request, res: Response): Promise<void> {
    try {
      const { 
        type, 
        name, 
        description, 
        content, 
        tags, 
        license, 
        parent_id 
      } = req.body as AssetPublishInput;
      
      const nodeId = req.headers['x-node-id'] as string;
      
      if (!nodeId) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'x-node-id header required for publishing',
        });
        return;
      }
      
      // Find the node
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
      
      if (node.status !== 'ACTIVE') {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Node must be active to publish assets',
        });
        return;
      }
      
      // Generate asset ID
      const assetId = generateAssetId(type);
      
      // Calculate GDI score using the scoring service
      const assetContent = {
        type,
        name,
        description,
        content,
        tags,
        license,
      };
      const gdiScoreResult = await gdiScoringService.calculateScore(assetContent);

      
      // Create asset
      const asset = await prisma.asset.create({
        data: {
          assetId,
          type: type.toUpperCase(),
          name,
          description,
          dna: content.dna,
          prompt: content.prompt,
          tools: JSON.stringify(content.tools),
          model: content.model,
          tags: JSON.stringify(tags),
          license,
          parentId: parent_id,
          gdiScore: gdiScoreResult.overall,
          gdiBreakdown: JSON.stringify({
            correctness: gdiScoreResult.correctness,
            diversity: gdiScoreResult.diversity,
            composability: gdiScoreResult.composability,
            helpfulness: gdiScoreResult.helpfulness,
          }),
          status: 'PENDING', // Pending review
          nodeId: node.id,
          userId: node.userId,
          publishedAt: new Date(),
        },
      });
      
      // Update node reputation slightly for publishing
      await prisma.reputationLog.create({
        data: {
          nodeId: node.nodeId,
          action: 'publish',
          delta: 0.1,
          reason: 'Asset published',
        },
      });
      
      res.status(201).json({
        asset_id: asset.assetId,
        type: asset.type.toLowerCase(),
        name: asset.name,
        gdi_score: asset.gdiScore,
        gdi_breakdown: {
          correctness: gdiScoreResult.correctness,
          diversity: gdiScoreResult.diversity,
          composability: gdiScoreResult.composability,
          helpfulness: gdiScoreResult.helpfulness,
        },
        status: 'pending',
        message: 'Asset published successfully with GDI evaluation.',
      });
    } catch (error) {
      console.error('Asset publish error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to publish asset',
      });
    }
  }
  
  // POST /a2a/fetch - Search and fetch assets
  async fetch(req: Request, res: Response): Promise<void> {
    try {
      const { 
        query, 
        type, 
        tags, 
        sort = 'recent', 
        limit = 20, 
        offset = 0 
      } = req.body as AssetFetchInput;
      
      // Build where clause
      const where: Record<string, unknown> = {
        status: 'PUBLISHED',
      };
      
      if (type) {
        where.type = type.toUpperCase();
      }
      
      // For SQLite with JSON strings, we need to filter in JavaScript
      // Get all matching assets first, then filter
      if (query) {
        where.OR = [
          { name: { contains: query } },
          { description: { contains: query } },
        ];
      }
      
      // Determine sort order
      let orderBy: Record<string, string> = { createdAt: 'desc' };
      if (sort === 'popular') {
        orderBy = { gdiScore: 'desc' };
      } else if (sort === 'gdi') {
        orderBy = { gdiScore: 'desc' };
      }
      
      // Fetch assets - for tags, we need to filter in JavaScript since SQLite stores as JSON string
      const assetsRaw = await prisma.asset.findMany({
        where,
        take: Number(limit) * 2, // Fetch more to account for tag filtering
        skip: Number(offset),
        orderBy,
        select: {
          assetId: true,
          type: true,
          name: true,
          description: true,
          tags: true,
          license: true,
          gdiScore: true,
          createdAt: true,
          publishedAt: true,
          node: {
            select: {
              nodeId: true,
              name: true,
              reputation: true,
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
      });
      
      // Filter by tags in JavaScript (since SQLite stores as JSON string)
      let filteredAssets = assetsRaw;
      if (tags && tags.length > 0) {
        filteredAssets = assetsRaw.filter(a => {
          const assetTags = JSON.parse(a.tags) as string[];
          return tags.some(tag => assetTags.includes(tag));
        });
      }
      
      // Parse JSON fields and limit results
      const assets = filteredAssets.slice(0, Number(limit)).map(a => ({
        ...a,
        tags: JSON.parse(a.tags),
      }));
      
      const total = await prisma.asset.count({ where });
      
      res.json({
        assets,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      console.error('Asset fetch error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to fetch assets',
      });
    }
  }
  
  // GET /a2a/asset/:assetId - Get asset details
  async getAsset(req: Request, res: Response): Promise<void> {
    try {
      const { assetId } = req.params;
      
      const assetRaw = await prisma.asset.findUnique({
        where: { assetId },
        include: {
          node: {
            select: {
              nodeId: true,
              name: true,
              reputation: true,
              level: true,
            },
          },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              user: {
                select: {
                  username: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
      
      if (!assetRaw) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Asset not found',
        });
        return;
      }
      
      const asset = {
        ...assetRaw,
        tools: JSON.parse(assetRaw.tools),
        tags: JSON.parse(assetRaw.tags),
        gdiBreakdown: assetRaw.gdiBreakdown ? JSON.parse(assetRaw.gdiBreakdown) : null,
      };
      
      if (!asset) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Asset not found',
        });
        return;
      }
      
      res.json({ asset });
    } catch (error) {
      console.error('Get asset error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get asset',
      });
    }
  }
  
  // POST /a2a/asset/:assetId/review - Submit a review
  async reviewAsset(req: Request, res: Response): Promise<void> {
    try {
      const { assetId } = req.params;
      const { rating, comment } = req.body;
      
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required to review',
        });
        return;
      }
      
      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Rating must be between 1 and 5',
        });
        return;
      }
      
      const asset = await prisma.asset.findUnique({
        where: { assetId },
      });
      
      if (!asset) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Asset not found',
        });
        return;
      }
      
      // Create review
      const review = await prisma.assetReview.create({
        data: {
          assetId: asset.id,
          userId: req.user.userId,
          rating,
          comment,
        },
      });
      
      // Update asset GDI score based on reviews
      const allReviews = await prisma.assetReview.findMany({
        where: { assetId: asset.id },
        select: { rating: true },
      });
      
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      
      await prisma.asset.update({
        where: { id: asset.id },
        data: {
          gdiScore: avgRating / 5, // Normalize to 0-1
        },
      });
      
      res.status(201).json({
        review_id: review.id,
        rating: review.rating,
        message: 'Review submitted successfully',
      });
    } catch (error) {
      console.error('Review asset error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to submit review',
      });
    }
  }
  
  // GET /assets/my - Get user's own assets
  async myAssets(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required',
        });
        return;
      }
      
      const assets = await prisma.asset.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
        select: {
          assetId: true,
          type: true,
          name: true,
          status: true,
          gdiScore: true,
          createdAt: true,
          publishedAt: true,
        },
      });
      
      res.json({ assets });
    } catch (error) {
      console.error('My assets error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get assets',
      });
    }
  }
}

export const assetController = new AssetController();

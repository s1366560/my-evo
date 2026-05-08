/**
 * Assets Route
 * Provides a simple REST API for listing and searching assets.
 * Used by the frontend's /api/frontend/assets proxy.
 */

import { Router } from 'express';
import prisma from '../db/prisma.js';

const router = Router();

// GET /assets/hot — Top-rated published assets for the Hot List carousel
router.get('/hot', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 6, 20);
    const assets = await prisma.asset.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { gdiScore: 'desc' },
      take: limit,
      select: {
        assetId: true,
        type: true,
        name: true,
        description: true,
        tags: true,
        gdiScore: true,
        nodeId: true,
      },
    });

    const formatted = assets.map(a => ({
      id: a.assetId,
      name: a.name,
      description: a.description || '',
      type: a.type?.toLowerCase() || 'gene',
      score: Math.round((a.gdiScore || 0) * 100),
      author: a.nodeId || 'Anonymous',
      downloads: 0,
      tags: (typeof a.tags === 'string' ? JSON.parse(a.tags) : a.tags) || [],
    }));

    res.json({ assets: formatted });
  } catch (err) {
    console.error('GET /assets/hot error:', err);
    res.status(500).json({ error: 'Failed to fetch hot assets' });
  }
});

// GET /assets — List/search assets (maps to the POST /a2a/fetch logic)
router.get('/', async (req, res) => {
  try {
    const {
      query = '',
      type,
      sort = 'recent',
      limit = '20',
      offset = '0',
    } = req.query as Record<string, string>;

    const where: Record<string, unknown> = { status: 'PUBLISHED' };
    if (type) where.type = type.toUpperCase();
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } },
      ];
    }

    const orderBy: Record<string, string> = sort === 'gdi' || sort === 'popular'
      ? { gdiScore: 'desc' }
      : { createdAt: 'desc' };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        take: Number(limit),
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
          status: true,
          nodeId: true,
        },
      }),
      prisma.asset.count({ where }),
    ]);

    // Format tags
    const formatted = assets.map(a => ({
      ...a,
      tags: typeof a.tags === 'string' ? JSON.parse(a.tags) : a.tags,
    }));

    res.json({ assets: formatted, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    console.error('GET /assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

export default router;

/**
 * Marketplace Statistics Service
 * 
 * Provides aggregate statistics and analytics for the marketplace,
 * including asset counts, node activity, bounty statistics, and trends.
 */

import prisma from '../db/prisma.js';

export interface MarketplaceStats {
  totalAssets: number;
  totalGenes: number;
  totalCapsules: number;
  totalNodes: number;
  activeNodes: number;
  totalBounties: number;
  activeBounties: number;
  completedBounties: number;
  totalUsers: number;
  recentActivity: ActivitySummary;
  topAssets: AssetSummary[];
  topNodes: NodeSummary[];
  topCreators: CreatorSummary[];
  trends: TrendData;
}

export interface ActivitySummary {
  newAssetsToday: number;
  newNodesToday: number;
  newBountiesToday: number;
  completedBountiesToday: number;
  totalTransactions: number;
}

export interface AssetSummary {
  assetId: string;
  name: string;
  type: string;
  gdiScore: number;
  views: number;
  calls: number;
}

export interface NodeSummary {
  nodeId: string;
  name: string;
  reputation: number;
  level: number;
  assetCount: number;
}

export interface CreatorSummary {
  userId: string;
  username: string;
  assetCount: number;
  totalGdiScore: number;
  avgGdiScore: number;
}

export interface TrendData {
  assetsLast7Days: number[];
  bountiesLast7Days: number[];
  nodesLast7Days: number[];
}

export class StatsService {
  /**
   * Get comprehensive marketplace statistics
   */
  async getMarketplaceStats(): Promise<MarketplaceStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel queries for efficiency
    const [
      totalAssets,
      totalGenes,
      totalCapsules,
      totalNodes,
      activeNodes,
      totalBounties,
      activeBounties,
      completedBounties,
      totalUsers,
      newAssetsToday,
      newNodesToday,
      newBountiesToday,
      completedToday,
    ] = await Promise.all([
      prisma.asset.count({ where: { status: 'PUBLISHED' } }),
      prisma.asset.count({ where: { type: 'GENE', status: 'PUBLISHED' } }),
      prisma.asset.count({ where: { type: 'CAPSULE', status: 'PUBLISHED' } }),
      prisma.node.count(),
      prisma.node.count({ where: { status: 'ACTIVE' } }),
      prisma.bounty.count(),
      prisma.bounty.count({ where: { status: 'OPEN' } }),
      prisma.bounty.count({ where: { status: 'COMPLETED' } }),
      prisma.user.count(),
      prisma.asset.count({ where: { publishedAt: { gte: today } } }),
      prisma.node.count({ where: { createdAt: { gte: today } } }),
      prisma.bounty.count({ where: { createdAt: { gte: today } } }),
      prisma.bounty.count({ where: { completedAt: { gte: today } } }),
    ]);

    // Get recent activity summary
    const recentActivity: ActivitySummary = {
      newAssetsToday,
      newNodesToday,
      newBountiesToday,
      completedBountiesToday: completedToday,
      totalTransactions: newAssetsToday + newNodesToday,
    };

    // Get top assets by GDI score
    const topAssets = await this.getTopAssets(5);

    // Get top nodes by reputation
    const topNodes = await this.getTopNodes(5);

    // Get top creators
    const topCreators = await this.getTopCreators(5);

    // Get trend data for last 7 days
    const trends = await this.getTrendData();

    return {
      totalAssets,
      totalGenes,
      totalCapsules,
      totalNodes,
      activeNodes,
      totalBounties,
      activeBounties,
      completedBounties,
      totalUsers,
      recentActivity,
      topAssets,
      topNodes,
      topCreators,
      trends,
    };
  }

  /**
   * Get top assets by GDI score
   */
  private async getTopAssets(limit: number): Promise<AssetSummary[]> {
    const assets = await prisma.asset.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { gdiScore: 'desc' },
      take: limit,
      select: {
        assetId: true,
        name: true,
        type: true,
        gdiScore: true,
        publishedAt: true,
      },
    });

    // In a real system, we'd have view/call tracking
    // For now, estimate based on age and score
    return assets.map(a => ({
      assetId: a.assetId,
      name: a.name,
      type: a.type,
      gdiScore: a.gdiScore,
      views: Math.floor(a.gdiScore * 1000),
      calls: Math.floor(a.gdiScore * 100),
    }));
  }

  /**
   * Get top nodes by reputation
   */
  private async getTopNodes(limit: number): Promise<NodeSummary[]> {
    const nodes = await prisma.node.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { reputation: 'desc' },
      take: limit,
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });

    return nodes.map(n => ({
      nodeId: n.nodeId,
      name: n.name,
      reputation: n.reputation,
      level: n.level,
      assetCount: n._count.assets,
    }));
  }

  /**
   * Get top creators by asset quality
   */
  private async getTopCreators(limit: number): Promise<CreatorSummary[]> {
    const creators = await prisma.user.findMany({
      include: {
        assets: {
          where: { status: 'PUBLISHED' },
          select: {
            gdiScore: true,
          },
        },
      },
      take: limit,
    });

    // Sort by average GDI score
    const scoredCreators = creators
      .map(u => ({
        userId: u.id,
        username: u.username,
        assetCount: u.assets.length,
        totalGdiScore: u.assets.reduce((sum, a) => sum + a.gdiScore, 0),
        avgGdiScore: u.assets.length > 0 
          ? u.assets.reduce((sum, a) => sum + a.gdiScore, 0) / u.assets.length 
          : 0,
      }))
      .filter(c => c.assetCount > 0)
      .sort((a, b) => b.avgGdiScore - a.avgGdiScore)
      .slice(0, limit);

    return scoredCreators;
  }

  /**
   * Get trend data for the last 7 days
   */
  private async getTrendData(): Promise<TrendData> {
    const assetsLast7Days: number[] = [];
    const bountiesLast7Days: number[] = [];
    const nodesLast7Days: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [newAssets, newBounties, newNodes] = await Promise.all([
        prisma.asset.count({
          where: {
            publishedAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        }),
        prisma.bounty.count({
          where: {
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        }),
        prisma.node.count({
          where: {
            createdAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        }),
      ]);

      assetsLast7Days.push(newAssets);
      bountiesLast7Days.push(newBounties);
      nodesLast7Days.push(newNodes);
    }

    return {
      assetsLast7Days,
      bountiesLast7Days,
      nodesLast7Days,
    };
  }

  /**
   * Get node-specific statistics
   */
  async getNodeStats(nodeId: string): Promise<{
    totalAssets: number;
    publishedAssets: number;
    totalViews: number;
    totalCalls: number;
    avgGdiScore: number;
    rank: number;
  } | null> {
    const node = await prisma.node.findUnique({
      where: { nodeId },
      include: {
        assets: {
          where: { status: 'PUBLISHED' },
        },
      },
    });

    if (!node) return null;

    const allNodes = await prisma.node.findMany({
      orderBy: { reputation: 'desc' },
      select: { nodeId: true },
    });

    const rank = allNodes.findIndex(n => n.nodeId === nodeId) + 1;

    const avgGdiScore = node.assets.length > 0
      ? node.assets.reduce((sum, a) => sum + a.gdiScore, 0) / node.assets.length
      : 0;

    return {
      totalAssets: node.assets.length,
      publishedAssets: node.assets.filter(a => a.status === 'PUBLISHED').length,
      totalViews: Math.floor(avgGdiScore * 1000),
      totalCalls: Math.floor(avgGdiScore * 100),
      avgGdiScore,
      rank,
    };
  }

  /**
   * Get asset-specific statistics
   */
  async getAssetStats(assetId: string): Promise<{
    totalReviews: number;
    avgRating: number;
    gdiScore: GDIScoreData;
    similarAssets: string[];
  } | null> {
    const asset = await prisma.asset.findUnique({
      where: { assetId },
      include: {
        reviews: true,
        node: {
          include: {
            assets: {
              where: { status: 'PUBLISHED', assetId: { not: assetId } },
              take: 5,
              select: { assetId: true },
            },
          },
        },
      },
    });

    if (!asset) return null;

    const avgRating = asset.reviews.length > 0
      ? asset.reviews.reduce((sum, r) => sum + r.rating, 0) / asset.reviews.length
      : 0;

    const gdiBreakdown = asset.gdiBreakdown 
      ? JSON.parse(asset.gdiBreakdown)
      : { correctness: 0, diversity: 0, composability: 0, helpfulness: asset.gdiScore };

    return {
      totalReviews: asset.reviews.length,
      avgRating,
      gdiScore: {
        overall: asset.gdiScore,
        ...gdiBreakdown,
      },
      similarAssets: asset.node.assets.map(a => a.assetId),
    };
  }
}

interface GDIScoreData {
  overall: number;
  correctness: number;
  diversity: number;
  composability: number;
  helpfulness: number;
}

export interface TrendingAsset {
  assetId: string;
  type: string;
  name: string;
  description: string | null;
  gdiScore: number;
  tags: string[];
  nodeName: string | null;
  nodeId: string | null;
  reviewCount: number;
  publishedAt: Date | null;
}

export const statsService = new StatsService();

StatsService.prototype.getTrending = async function(
  limit: number = 10,
  type?: string
): Promise<TrendingAsset[]> {
  const where: Record<string, unknown> = { status: 'PUBLISHED' };
  if (type) where.type = type.toUpperCase();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { gdiScore: 'desc' },
    take: limit,
    include: {
      node: {
        select: { name: true, nodeId: true },
      },
      _count: {
        select: { reviews: true },
      },
    },
  });

  return assets.map(a => ({
    assetId: a.assetId,
    type: a.type,
    name: a.name,
    description: a.description,
    gdiScore: a.gdiScore,
    tags: JSON.parse(a.tags) as string[],
    nodeName: a.node?.name ?? null,
    nodeId: a.node?.nodeId ?? null,
    reviewCount: a._count.reviews,
    publishedAt: a.publishedAt,
  }));
};

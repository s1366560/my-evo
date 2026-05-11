/**
 * Stats Controller
 * 
 * Handles marketplace statistics and analytics endpoints.
 */

import { Request, Response } from 'express';
import { statsService } from '../services/statsService.js';

export class StatsController {
  /**
   * GET /marketplace/stats - Get marketplace statistics
   */
  async getMarketplaceStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await statsService.getMarketplaceStats();
      res.json(stats);
    } catch (error) {
      console.error('Get marketplace stats error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get marketplace statistics',
      });
    }
  }

  /**
   * GET /marketplace/node/:nodeId/stats - Get node statistics
   */
  async getNodeStats(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const stats = await statsService.getNodeStats(nodeId);

      if (!stats) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Node not found',
        });
        return;
      }

      res.json({ nodeId, ...stats });
    } catch (error) {
      console.error('Get node stats error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get node statistics',
      });
    }
  }

  /**
   * GET /marketplace/asset/:assetId/stats - Get asset statistics
   */
  async getAssetStats(req: Request, res: Response): Promise<void> {
    try {
      const { assetId } = req.params;
      const stats = await statsService.getAssetStats(assetId);

      if (!stats) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Asset not found',
        });
        return;
      }

      res.json({ assetId, ...stats });
    } catch (error) {
      console.error('Get asset stats error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get asset statistics',
      });
    }
  }

  /**
   * GET /marketplace/trending - Get trending assets (EvoMap client gene discovery endpoint)
   */
  async getTrending(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const type = req.query.type as string | undefined;

      const trending = await statsService.getTrending(limit, type);
      res.json({ trending, limit, type: type || 'all' });
    } catch (error) {
      console.error('Get trending error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get trending assets',
      });
    }
  }
}

export const statsController = new StatsController();

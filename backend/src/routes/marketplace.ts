/**
 * Marketplace Routes
 * 
 * Provides marketplace-specific endpoints including:
 * - Marketplace statistics
 * - Asset discovery and trending
 * - Node leaderboards
 */

import { Router } from 'express';
import { statsController } from '../controllers/statsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /marketplace/stats - Get marketplace statistics
router.get('/stats', (req, res) => {
  statsController.getMarketplaceStats(req, res);
});

// GET /marketplace/node/:nodeId/stats - Get node statistics
router.get('/node/:nodeId/stats', (req, res) => {
  statsController.getNodeStats(req, res);
});

// GET /marketplace/asset/:assetId/stats - Get asset statistics
router.get('/asset/:assetId/stats', (req, res) => {
  statsController.getAssetStats(req, res);
});

// GET /marketplace/trending - Get trending assets (EvoMap client gene discovery)
router.get('/trending', (req, res) => {
  statsController.getTrending(req, res);
});

export default router;

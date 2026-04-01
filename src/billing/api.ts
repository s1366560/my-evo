/**
 * Billing API
 * GET /billing/earnings/:agentId - Get earnings summary for an agent
 */

import { Router, Request, Response } from 'express';
import { getEarningsSummary, getEarningsByPeriod } from './engine';

const router = Router();

/**
 * GET /billing/earnings/:agentId
 * 
 * Get earnings summary for an agent based on their Capsule contributions.
 * 
 * Based on skill-platform.md Revenue and Attribution section:
 * - When a Capsule is used to answer a question, a ContributionRecord is created
 * - Quality signals (GDI, validation pass rate, user feedback) determine contribution_score
 * - Reputation score (0-100) multiplies payout rate
 * 
 * Query params:
 *   - period: 'day' | 'week' | 'month' | 'year' (default: 'month')
 * 
 * Response:
 *   - agent_id: The agent's node ID
 *   - total_earnings: Total credits earned in the period
 *   - total_contributions: Number of Capsule usages
 *   - pending_earnings: Earnings from the last 7 days
 *   - lifetime_revenue: All-time earnings
 *   - payout_multiplier: Based on reputation score
 *   - breakdown: Per-capsule earnings breakdown
 * 
 * @see https://docs.evomap.ai/billing/earnings
 */
router.get('/earnings/:agentId', (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const { period } = req.query as { period?: 'day' | 'week' | 'month' | 'year' };

    if (!agentId) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'agentId is required',
      });
      return;
    }

    const summary = getEarningsSummary(agentId);

    // Also return period breakdown if requested
    if (period) {
      const byPeriod = getEarningsByPeriod(agentId, period);
      res.json({
        ...summary,
        by_period: byPeriod,
      });
      return;
    }

    res.json(summary);
  } catch (error) {
    console.error('Earnings error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

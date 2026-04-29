import { Router, Request, Response } from 'express';

const router = Router();

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'user_demo_01',
  username: 'demouser',
  email: 'demo@evomap.ai',
  node_id: 'node_demo_01',
  reputation: 78.4,
  trust_level: 'silver',
  member_since: '2026-01-15T00:00:00Z',
};

const MOCK_CREDITS = {
  balance: 4820.5,
  pending: 350.0,
  trend: 'up' as const,
  trend_percent: 12.3,
};

const MOCK_STATS = {
  total_assets: 12,
  total_calls: 1842,
  total_views: 9320,
  today_calls: 87,
  total_bounties_earned: 3500,
  active_bounties: 3,
  swarm_sessions: 7,
  completed_swarm_sessions: 5,
};

const MOCK_RECENT_ASSETS = [
  {
    id: 'asset_001',
    name: 'Advanced Code Review Gene',
    type: 'gene',
    gdi_score: 87.2,
    calls: 342,
    views: 1840,
    signals: ['repair', 'optimize'],
    updated_at: '2026-04-28T10:30:00Z',
  },
  {
    id: 'asset_002',
    name: 'Data Pipeline Capsule',
    type: 'capsule',
    gdi_score: 91.5,
    calls: 521,
    views: 3200,
    signals: ['explore'],
    updated_at: '2026-04-27T14:15:00Z',
  },
  {
    id: 'asset_003',
    name: 'API Optimization Recipe',
    type: 'recipe',
    gdi_score: 83.8,
    calls: 198,
    views: 920,
    signals: ['optimize', 'repair'],
    updated_at: '2026-04-26T09:00:00Z',
  },
];

const MOCK_ACTIVITY = [
  {
    id: 'act_001',
    type: 'asset_published',
    message: 'Published "Advanced Code Review Gene"',
    timestamp: '2026-04-28T10:30:00Z',
  },
  {
    id: 'act_002',
    type: 'bounty_earned',
    message: 'Earned 500 credits from bounty "Fix retry logic"',
    timestamp: '2026-04-27T16:45:00Z',
  },
  {
    id: 'act_003',
    type: 'asset_calls',
    message: '"Data Pipeline Capsule" reached 500 calls',
    timestamp: '2026-04-27T12:00:00Z',
  },
  {
    id: 'act_004',
    type: 'swarm_completed',
    message: 'Swarm session "ML pipeline optimization" completed',
    timestamp: '2026-04-26T18:30:00Z',
  },
  {
    id: 'act_005',
    type: 'gdi_improved',
    message: 'GDI score improved to 78.4 (+2.1 this week)',
    timestamp: '2026-04-26T08:00:00Z',
  },
  {
    id: 'act_006',
    type: 'asset_published',
    message: 'Published "API Optimization Recipe"',
    timestamp: '2026-04-25T11:20:00Z',
  },
];

const MOCK_TRENDING = [
  { signal: 'repair', count: 4821 },
  { signal: 'optimize', count: 3942 },
  { signal: 'innovate', count: 2847 },
  { signal: 'explore', count: 2103 },
  { signal: 'discover', count: 1872 },
];

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/dashboard
 * Returns full dashboard data
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    user: MOCK_USER,
    credits: MOCK_CREDITS,
    stats: MOCK_STATS,
    recent_assets: MOCK_RECENT_ASSETS,
    recent_activity: MOCK_ACTIVITY,
    trending_signals: MOCK_TRENDING,
  });
});

/**
 * GET /api/v2/dashboard/user
 * Returns user profile portion of dashboard
 */
router.get('/user', (_req: Request, res: Response) => {
  res.json(MOCK_USER);
});

/**
 * GET /api/v2/dashboard/stats
 * Returns stats portion of dashboard
 */
router.get('/stats', (_req: Request, res: Response) => {
  res.json(MOCK_STATS);
});

/**
 * GET /api/v2/dashboard/assets
 * Returns recent assets portion of dashboard
 */
router.get('/assets', (_req: Request, res: Response) => {
  res.json(MOCK_RECENT_ASSETS);
});

/**
 * GET /api/v2/dashboard/activity
 * Returns activity feed portion of dashboard
 */
router.get('/activity', (_req: Request, res: Response) => {
  res.json(MOCK_ACTIVITY);
});

/**
 * GET /api/v2/dashboard/trending
 * Returns trending signals for the dashboard
 */
router.get('/trending', (_req: Request, res: Response) => {
  res.json(MOCK_TRENDING);
});

/**
 * GET /api/v2/dashboard/credits
 * Returns credits portion of dashboard
 */
router.get('/credits', (_req: Request, res: Response) => {
  res.json(MOCK_CREDITS);
});

export { router as dashboardRouter };

/**
 * MSW Handlers for Dashboard API
 *
 * Covers:
 *   GET /api/v2/dashboard          — full dashboard snapshot
 *   GET /api/v2/dashboard/user    — user portion
 *   GET /api/v2/dashboard/stats   — stats portion
 *   GET /api/v2/dashboard/assets  — recent assets
 *   GET /api/v2/dashboard/activity — activity feed
 *   GET /api/v2/dashboard/trending — trending signals
 *   GET /api/v2/dashboard/credits — credits portion
 */

import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, delay } from './handlers';

// ── Shared mock data ───────────────────────────────────────────────────────────

const mockDashboardUser = {
  id: MOCK_USER_ID,
  username: 'DemoNode',
  email: 'user@example.com',
  node_id: 'node-demo-001',
  reputation: 86,
  trust_level: 'verified',
  member_since: '2026-01-15T08:00:00.000Z',
};

const mockDashboardCredits = {
  balance: 12480,
  pending: 320,
  trend: 'up' as const,
  trend_percent: 8,
};

const mockDashboardStats = {
  total_assets: 12,
  total_calls: 4821,
  total_views: 9340,
  today_calls: 147,
  total_bounties_earned: 850,
  active_bounties: 2,
  swarm_sessions: 5,
  completed_swarm_sessions: 3,
};

const mockRecentAssets = [
  {
    id: 'gene-001',
    name: 'context-window-scheduler',
    type: 'gene' as const,
    gdi_score: 82,
    calls: 1243,
    views: 3210,
    signals: ['context', 'memory', 'scheduling'],
    updated_at: '2026-04-28T10:00:00Z',
  },
  {
    id: 'gene-002',
    name: 'retrieval-augmented-gen',
    type: 'gene' as const,
    gdi_score: 91,
    calls: 3810,
    views: 8920,
    signals: ['rag', 'retrieval', 'knowledge'],
    updated_at: '2026-04-27T14:00:00Z',
  },
  {
    id: 'capsule-001',
    name: 'code-review-agent',
    type: 'capsule' as const,
    gdi_score: 78,
    calls: 567,
    views: 1340,
    signals: ['code', 'review', 'quality'],
    updated_at: '2026-04-26T09:00:00Z',
  },
  {
    id: 'capsule-002',
    name: 'security-scanner',
    type: 'capsule' as const,
    gdi_score: 88,
    calls: 2109,
    views: 4102,
    signals: ['security', 'scan', 'vulnerability'],
    updated_at: '2026-04-25T16:00:00Z',
  },
  {
    id: 'recipe-001',
    name: 'fast-rag-pipeline',
    type: 'recipe' as const,
    gdi_score: 85,
    calls: 934,
    views: 2200,
    signals: ['rag', 'fast', 'pipeline'],
    updated_at: '2026-04-24T11:00:00Z',
  },
];

const mockRecentActivity = [
  {
    id: 'act-1',
    type: 'publish',
    message: "Published Gene 'context-window-scheduler'",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-2',
    type: 'earn',
    message: 'Earned 320 credits from downloads',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-3',
    type: 'swarm',
    message: "Joined Swarm 'code-analysis-team'",
    timestamp: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-4',
    type: 'publish',
    message: "Published Capsule 'data-parser'",
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'act-5',
    type: 'vote',
    message: 'Voted on Council proposal #42',
    timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

const mockTrendingSignals = [
  { signal: 'rag', count: 1243 },
  { signal: 'code', count: 982 },
  { signal: 'security', count: 876 },
  { signal: 'context', count: 654 },
  { signal: 'retrieval', count: 543 },
  { signal: 'planning', count: 421 },
  { signal: 'reasoning', count: 398 },
  { signal: 'memory', count: 312 },
];

// ── Agent node mock data (used by /dashboard/agents) ───────────────────────────

export const mockAgentNodes = [
  {
    node_id: 'node_demo_alpha',
    model: 'claude-3-5-sonnet',
    status: 'active',
    reputation: 78,
    credit_balance: 4230,
    registered_at: '2026-03-01T10:00:00Z',
  },
  {
    node_id: 'node_demo_beta',
    model: 'gpt-4o',
    status: 'active',
    reputation: 65,
    credit_balance: 2150,
    registered_at: '2026-03-15T14:30:00Z',
  },
  {
    node_id: 'node_demo_gamma',
    model: 'gemini-2.0-flash',
    status: 'inactive',
    reputation: 42,
    credit_balance: 800,
    registered_at: '2026-04-01T09:00:00Z',
  },
];

// ── Handlers ───────────────────────────────────────────────────────────────────

export const dashboardHandlers = [
  // GET /api/v2/dashboard — full snapshot
  http.get('http://localhost:3001/api/v2/dashboard', async () => {
    await delay(250);
    return HttpResponse.json({
      user: mockDashboardUser,
      credits: mockDashboardCredits,
      stats: mockDashboardStats,
      recent_assets: mockRecentAssets,
      recent_activity: mockRecentActivity,
      trending_signals: mockTrendingSignals,
    });
  }),

  // GET /api/v2/dashboard/user
  http.get('http://localhost:3001/api/v2/dashboard/user', async () => {
    await delay(150);
    return HttpResponse.json(mockDashboardUser);
  }),

  // GET /api/v2/dashboard/stats
  http.get('http://localhost:3001/api/v2/dashboard/stats', async () => {
    await delay(180);
    return HttpResponse.json(mockDashboardStats);
  }),

  // GET /api/v2/dashboard/assets
  http.get('http://localhost:3001/api/v2/dashboard/assets', async () => {
    await delay(200);
    return HttpResponse.json(mockRecentAssets);
  }),

  // GET /api/v2/dashboard/activity
  http.get('http://localhost:3001/api/v2/dashboard/activity', async () => {
    await delay(180);
    return HttpResponse.json(mockRecentActivity);
  }),

  // GET /api/v2/dashboard/trending
  http.get('http://localhost:3001/api/v2/dashboard/trending', async () => {
    await delay(150);
    return HttpResponse.json(mockTrendingSignals);
  }),

  // GET /api/v2/dashboard/credits
  http.get('http://localhost:3001/api/v2/dashboard/credits', async () => {
    await delay(150);
    return HttpResponse.json(mockDashboardCredits);
  }),
];

// ── Re-export mock data for use in tests ──────────────────────────────────────
export {
  mockDashboardUser,
  mockDashboardCredits,
  mockDashboardStats,
  mockRecentAssets,
  mockRecentActivity,
  mockTrendingSignals,
};

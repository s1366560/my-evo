/**
 * BFF-level MSW handlers for bounty API (localhost:3002)
 *
 * These intercept the same requests that the app makes via relative URLs,
 * which resolve to the Next.js BFF (localhost:3002) rather than the backend (localhost:3001).
 * Without these handlers, requests fall through to the real BFF which proxies to the backend.
 */
import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, delay } from './handlers';

// Use 'let' to allow push() in createBounty handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBountyList: any[] = [
  {
    bounty_id: 'bty_01J8K4M6N7P9Q2R3S5T6U7V8W',
    title: 'Build E2E test coverage for auth flow',
    description: 'Add comprehensive Playwright tests covering login, registration, and session management flows.',
    requirements: ['Create tests in /tests/e2e/auth.spec.ts', 'Cover login, register, logout flows', 'Use page objects pattern'],
    amount: 300, status: 'open', creator_id: MOCK_USER_ID, creator_name: 'EvoMap Team',
    deadline: '2026-05-05T23:59:59.000Z', created_at: '2026-04-25T10:00:00.000Z',
    claimed_by: undefined, claimed_by_name: undefined, submissions_count: 0,
    milestones: [
      { milestone_id: 'ms_001', title: 'Test plan', description: 'Set up structure', percentage: 25, status: 'pending' },
      { milestone_id: 'ms_002', title: 'Auth flow tests', description: 'All auth cases', percentage: 50, status: 'pending' },
      { milestone_id: 'ms_003', title: 'Session tests', description: 'Expiry & errors', percentage: 25, status: 'pending' },
    ],
  },
  {
    bounty_id: 'bty_01J8K4M6N7P9Q2R3S5T6U7V9',
    title: 'Add React Query hooks',
    description: 'Implement hooks for workspace API.',
    requirements: ['lib/hooks', 'React Query v5'],
    amount: 200, status: 'open',
    creator_id: MOCK_USER_ID, creator_name: 'EvoMap Team',
    deadline: '2026-06-01T23:59:59.000Z', created_at: '2026-04-24T09:00:00.000Z',
    claimed_by: undefined, claimed_by_name: undefined, submissions_count: 0,
    milestones: [],
  },
  {
    bounty_id: 'bty_01J8K4M6N7P9Q2R3S5T6U8B1',
    title: 'Fix TypeScript errors',
    description: 'Resolve strict-mode errors.',
    requirements: ['tsc --noEmit'],
    amount: 150, status: 'claimed',
    creator_id: MOCK_USER_ID, creator_name: 'EvoMap Team',
    deadline: '2026-05-15T23:59:59.000Z', created_at: '2026-04-20T11:00:00.000Z',
    claimed_by: 'node_worker_01', claimed_by_name: 'WorkerNode', submissions_count: 0,
    milestones: [],
  },
];

const mockBountyDetail = {
  bounty_id: 'bty_01J8K4M6N7P9Q2R3S5T6U7V8W',
  title: 'Build E2E test coverage for auth flow',
  description: 'Add comprehensive Playwright tests covering login, registration, and session management flows.',
  requirements: ['Create tests in /tests/e2e/auth.spec.ts', 'Cover login, register, logout flows', 'Use page objects pattern'],
  amount: 300, status: 'open',
  creator_id: MOCK_USER_ID, creator_name: 'EvoMap Team',
  deadline: '2026-05-05T23:59:59.000Z', created_at: '2026-04-25T10:00:00.000Z',
  claimed_by: undefined, claimed_by_name: undefined, submissions_count: 2,
  milestones: [
    { milestone_id: 'ms_001', title: 'Test plan', description: 'Set up structure', percentage: 25, status: 'pending' },
    { milestone_id: 'ms_002', title: 'Auth flow tests', description: 'All auth cases', percentage: 50, status: 'pending' },
    { milestone_id: 'ms_003', title: 'Session tests', description: 'Expiry & errors', percentage: 25, status: 'pending' },
  ],
};

const mockBountyStats = {
  total_bounties: 24,
  open: 12,
  in_progress: 6,
  completed: 5,
  expired: 1,
  total_reward_pool: 18500,
};

// Track bids in memory
const localBids = new Map<string, { bid_id: string; bounty_id: string; bidder_id: string; bidder_name: string; proposed_amount: number; estimated_time: string; approach: string; created_at: string }>();

export const bountyBffHandlers = [
  // GET /api/v2/bounty/ — list all bounties
  http.get('http://127.0.0.1:3002/api/v2/bounty/', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    let filtered = [...mockBountyList];
    if (status) filtered = filtered.filter((b) => b.status === status);
    const page = filtered.slice(offset, offset + limit);
    return HttpResponse.json({ success: true, bounties: page, total: filtered.length, data: page });
  }),

  // GET /api/v2/bounty/:bountyId
  http.get('http://127.0.0.1:3002/api/v2/bounty/:bountyId', async ({ params }) => {
    await delay(150);
    const bounty = mockBountyList.find((b) => b.bounty_id === params.bountyId) || mockBountyDetail;
    return HttpResponse.json({ success: true, bounty, data: bounty });
  }),

  // GET /api/v2/bounty/open
  http.get('http://127.0.0.1:3002/api/v2/bounty/open', async () => {
    await delay(180);
    const open = mockBountyList.filter((b) => b.status === 'open');
    const totalRewardPool = open.reduce((sum, b) => sum + b.amount, 0);
    return HttpResponse.json({ success: true, bounties: open, total_open: open.length, total_reward_pool: totalRewardPool });
  }),

  // GET /api/v2/bounty/stats
  http.get('http://127.0.0.1:3002/api/v2/bounty/stats', async () => {
    await delay(150);
    return HttpResponse.json(mockBountyStats);
  }),

  // POST /api/v2/bounty/ — create bounty
  http.post('http://127.0.0.1:3002/api/v2/bounty/', async ({ request }) => {
    const body = await request.json() as { title?: string; amount?: number; deadline?: string };
    if (!body.title || !body.amount) {
      return HttpResponse.json({ success: false, error: 'VALIDATION_ERROR', message: 'Title and amount are required' }, { status: 400 });
    }
    const amount = body.amount;
    const newBounty = {
      bounty_id: `bty_${Date.now()}`,
      title: body.title,
      description: '',
      requirements: [],
      amount,
      status: 'open',
      creator_id: MOCK_USER_ID,
      creator_name: 'DemoUser',
      deadline: body.deadline || '2026-06-30T23:59:59.000Z',
      created_at: new Date().toISOString(),
      submissions_count: 0,
      milestones: [],
    };
    mockBountyList.push(newBounty);
    return HttpResponse.json({ success: true, bounty_id: newBounty.bounty_id, state: 'open', reward: amount, created_at: newBounty.created_at, data: newBounty }, { status: 201 });
  }),

  // POST /api/v2/bounty/:bountyId/bid
  http.post('http://127.0.0.1:3002/api/v2/bounty/:bountyId/bid', async ({ params, request }) => {
    const body = await request.json() as { proposedAmount?: number; estimatedTime?: string; approach?: string };
    const bounty = mockBountyList.find((b) => b.bounty_id === params.bountyId) || mockBountyDetail;
    if (bounty.status !== 'open') {
      return HttpResponse.json({ success: false, error: 'INVALID_STATUS', message: 'Bounty is not open' }, { status: 400 });
    }
    const bid = {
      bid_id: `bid_${Date.now()}`,
      bounty_id: params.bountyId as string,
      bidder_id: MOCK_USER_ID,
      bidder_name: 'DemoUser',
      proposed_amount: body.proposedAmount ?? 100,
      estimated_time: body.estimatedTime ?? '2-3 days',
      approach: body.approach ?? '',
      created_at: new Date().toISOString(),
    };
    localBids.set(bid.bid_id, bid);
    return HttpResponse.json({ success: true, bid });
  }),

  // POST /api/v2/bounty/:bountyId/submit
  http.post('http://127.0.0.1:3002/api/v2/bounty/:bountyId/submit', async ({ params, request }) => {
    const body = await request.json() as { content?: string; attachments?: string[]; milestone_id?: string };
    const idx = mockBountyList.findIndex((b) => b.bounty_id === params.bountyId);
    const bounty = idx >= 0 ? mockBountyList[idx] : mockBountyDetail;
    const deliverable = {
      deliverable_id: `del_${Date.now()}`,
      bounty_id: params.bountyId as string,
      worker_id: MOCK_USER_ID,
      content: body.content ?? '',
      attachments: body.attachments ?? [],
      submitted_at: new Date().toISOString(),
      milestone_id: body.milestone_id,
    };
    if (idx >= 0) {
      mockBountyList[idx] = { ...mockBountyList[idx], status: 'submitted', submissions_count: (mockBountyList[idx].submissions_count ?? 0) + 1 };
    }
    return HttpResponse.json({ success: true, bounty, deliverable, data: bounty });
  }),
];

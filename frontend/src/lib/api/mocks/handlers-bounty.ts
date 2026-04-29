import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, delay } from './handlers';

type Bounty = {
  bounty_id: string; title: string; description: string; requirements: string[];
  amount: number; status: string; creator_id: string; creator_name?: string;
  deadline: string; created_at: string; claimed_by?: string; claimed_by_name?: string;
  submissions_count: number;
  milestones: { milestone_id: string; title: string; description: string; percentage: number; status: string }[];
};

export const mockBounty: Bounty = {
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
};

export const mockBountyList: Bounty[] = [
  mockBounty,
  { ...mockBounty, bounty_id: 'bty_01J8K4M6N7P9Q2R3S5T6U7V9', title: 'Add React Query hooks', description: 'Implement hooks for workspace API.', requirements: ['lib/hooks', 'React Query v5'], amount: 200, status: 'open', created_at: '2026-04-24T09:00:00.000Z', milestones: [] },
  { ...mockBounty, bounty_id: 'bty_01J8K4M6N7P9Q2R3S5T6U8B1', title: 'Fix TypeScript errors', description: 'Resolve strict-mode errors.', requirements: ['tsc --noEmit'], amount: 150, status: 'claimed', claimed_by: 'node_worker_01', claimed_by_name: 'WorkerNode', created_at: '2026-04-20T11:00:00.000Z', milestones: [] },
];

const localBids = new Map<string, { bid_id: string; bounty_id: string; bidder_id: string; bidder_name: string; proposed_amount: number; estimated_time: string; approach: string; created_at: string }>();

// GET /api/v2/bounty/:bountyId
const getBountyById = http.get('http://localhost:3001/api/v2/bounty/:bountyId', async ({ params }) => {
  await delay(150);
  const bounty = mockBountyList.find((b) => b.bounty_id === params.bountyId);
  if (!bounty) return HttpResponse.json({ success: false, error: 'NOT_FOUND', message: 'Bounty not found' }, { status: 404 });
  return HttpResponse.json({ success: true, bounty, data: bounty });
});

// GET /api/v2/bounty/
const listBounties = http.get('http://localhost:3001/api/v2/bounty/', async ({ request }) => {
  await delay(200);
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  let filtered = [...mockBountyList];
  if (status) filtered = filtered.filter((b) => b.status === status);
  const page = filtered.slice(offset, offset + limit);
  return HttpResponse.json({ success: true, bounties: page, total: filtered.length, data: page });
});

// GET /api/v2/bounty/open
const getOpenBounties = http.get('http://localhost:3001/api/v2/bounty/open', async () => {
  await delay(180);
  const open = mockBountyList.filter((b) => b.status === 'open');
  const totalRewardPool = open.reduce((sum, b) => sum + b.amount, 0);
  return HttpResponse.json({ success: true, bounties: open, total_open: open.length, total_reward_pool: totalRewardPool, data: { bounties: open, total_open: open.length, total_reward_pool: totalRewardPool } });
});

// GET /api/v2/bounty/stats
const getBountyStats = http.get('http://localhost:3001/api/v2/bounty/stats', async () => {
  await delay(120);
  const list = mockBountyList;
  return HttpResponse.json({ success: true, total_bounties: list.length, open: list.filter((b) => b.status === 'open').length, in_progress: list.filter((b) => b.status === 'claimed' || b.status === 'submitted').length, completed: list.filter((b) => b.status === 'accepted').length, expired: 0, data: { total_bounties: list.length, open: list.filter((b) => b.status === 'open').length, in_progress: 0, completed: 0, expired: 0 } });
});

// POST /api/v2/bounty/:bountyId/bid
const placeBid = http.post('http://localhost:3001/api/v2/bounty/:bountyId/bid', async ({ params, request }) => {
  await delay(250);
  const bounty = mockBountyList.find((b) => b.bounty_id === params.bountyId);
  if (!bounty) return HttpResponse.json({ success: false, error: 'NOT_FOUND', message: 'Bounty not found' }, { status: 404 });
  if (bounty.status !== 'open') return HttpResponse.json({ success: false, error: 'INVALID_STATUS', message: 'Bounty is not open' }, { status: 400 });
  const body = await request.json() as { proposedAmount?: number; proposed_price?: number; estimatedTime?: string; approach?: string };
  const proposedAmount = body.proposedAmount ?? body.proposed_price;
  if (!proposedAmount || !body.estimatedTime || !body.approach) {
    return HttpResponse.json({ success: false, error: 'VALIDATION_ERROR', message: 'Missing required fields' }, { status: 400 });
  }
  const bid = { bid_id: `bid_${Date.now()}`, bounty_id: params.bountyId as string, bidder_id: MOCK_USER_ID, bidder_name: 'DemoUser', proposed_amount: proposedAmount, estimated_time: body.estimatedTime, approach: body.approach, created_at: new Date().toISOString() };
  localBids.set(bid.bid_id, bid);
  return HttpResponse.json({ success: true, bid, data: bid });
});

// POST /api/v2/bounty/:bountyId/submit
const submitBounty = http.post('http://localhost:3001/api/v2/bounty/:bountyId/submit', async ({ params, request }) => {
  await delay(300);
  const idx = mockBountyList.findIndex((b) => b.bounty_id === params.bountyId);
  if (idx === -1) return HttpResponse.json({ success: false, error: 'NOT_FOUND', message: 'Bounty not found' }, { status: 404 });
  const body = await request.json() as { content?: string; attachments?: string[]; milestone_id?: string };
  if (!body.content) return HttpResponse.json({ success: false, error: 'VALIDATION_ERROR', message: 'content is required' }, { status: 400 });
  const deliverable = { deliverable_id: `del_${Date.now()}`, bounty_id: params.bountyId as string, worker_id: MOCK_USER_ID, content: body.content, attachments: body.attachments ?? [], submitted_at: new Date().toISOString(), milestone_id: body.milestone_id };
  mockBountyList[idx] = { ...mockBountyList[idx], status: 'submitted', submissions_count: (mockBountyList[idx].submissions_count ?? 0) + 1 };
  return HttpResponse.json({ success: true, bounty: mockBountyList[idx], deliverable, data: mockBountyList[idx] });
});

// POST /api/v2/bounty/:bountyId/accept-bid
const acceptBid = http.post('http://localhost:3001/api/v2/bounty/:bountyId/accept-bid', async ({ params, request }) => {
  await delay(200);
  const idx = mockBountyList.findIndex((b) => b.bounty_id === params.bountyId);
  if (idx === -1) return HttpResponse.json({ success: false, error: 'NOT_FOUND', message: 'Bounty not found' }, { status: 404 });
  const body = await request.json() as { bidId: string };
  if (!body.bidId) return HttpResponse.json({ success: false, error: 'VALIDATION_ERROR', message: 'bidId required' }, { status: 400 });
  mockBountyList[idx] = { ...mockBountyList[idx], status: 'claimed', claimed_by: MOCK_USER_ID, claimed_by_name: 'DemoUser' };
  return HttpResponse.json({ success: true, bounty: mockBountyList[idx], data: mockBountyList[idx] });
});

// POST /api/v2/bounty/:bountyId/cancel
const cancelBounty = http.post('http://localhost:3001/api/v2/bounty/:bountyId/cancel', async ({ params }) => {
  await delay(150);
  const idx = mockBountyList.findIndex((b) => b.bounty_id === params.bountyId);
  if (idx === -1) return HttpResponse.json({ success: false, error: 'NOT_FOUND', message: 'Bounty not found' }, { status: 404 });
  mockBountyList[idx] = { ...mockBountyList[idx], status: 'cancelled' };
  return HttpResponse.json({ success: true, bounty: mockBountyList[idx], data: mockBountyList[idx] });
});

// POST /api/v2/bounty/:bountyId/review
const reviewBounty = http.post('http://localhost:3001/api/v2/bounty/:bountyId/review', async ({ params, request }) => {
  await delay(250);
  const idx = mockBountyList.findIndex((b) => b.bounty_id === params.bountyId);
  if (idx === -1) return HttpResponse.json({ success: false, error: 'NOT_FOUND', message: 'Bounty not found' }, { status: 404 });
  const body = await request.json() as { accepted: boolean };
  mockBountyList[idx] = { ...mockBountyList[idx], status: body.accepted ? 'accepted' : 'claimed' };
  return HttpResponse.json({ success: true, bounty: mockBountyList[idx], data: mockBountyList[idx] });
});

// POST /api/v2/bounty/ (create)
const createBounty = http.post('http://localhost:3001/api/v2/bounty/', async ({ request }) => {
  await delay(300);
  const body = await request.json() as { title: string; description: string; requirements?: string[]; amount?: number; reward?: number; deadline: string };
  if (!body.title || !body.description || !body.deadline) {
    return HttpResponse.json({ success: false, error: 'VALIDATION_ERROR', message: 'Missing required fields' }, { status: 400 });
  }
  const amount = body.amount ?? body.reward ?? 100;
  const newBounty: Bounty = { bounty_id: `bty_${Date.now()}`, title: body.title, description: body.description, requirements: body.requirements ?? [], amount, status: 'open', creator_id: MOCK_USER_ID, creator_name: 'DemoUser', deadline: body.deadline, created_at: new Date().toISOString(), submissions_count: 0, milestones: [] };
  mockBountyList.push(newBounty);
  return HttpResponse.json({ success: true, bounty_id: newBounty.bounty_id, state: 'open', reward: amount, created_at: newBounty.created_at, data: newBounty }, { status: 201 });
});

// GET /api/v2/bounty/my
const getMyBounties = http.get('http://localhost:3001/api/v2/bounty/my', async () => {
  await delay(200);
  const my = mockBountyList.filter((b) => b.creator_id === MOCK_USER_ID);
  return HttpResponse.json({ success: true, bounties: my, total: my.length, data: my });
});

export const bountyHandlers = [
  getBountyById, listBounties, getOpenBounties, getBountyStats,
  placeBid, submitBounty, acceptBid, cancelBounty, reviewBounty,
  createBounty, getMyBounties,
];

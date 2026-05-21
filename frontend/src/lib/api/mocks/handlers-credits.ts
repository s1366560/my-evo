import { http, HttpResponse } from 'msw';
import { MOCK_USER_ID, MOCK_WORKSPACE_ID, delay } from './handlers';

export const mockCredits = {
  workspaceId: MOCK_WORKSPACE_ID,
  balance: 5000,
  totalEarned: 15000,
  totalSpent: 10000,
  pending: 0,
  updatedAt: '2026-04-28T08:00:00.000Z',
};

export const mockCreditsHistory = [
  { id: 'txn_01', workspaceId: MOCK_WORKSPACE_ID, type: 'debit', amount: 300, balanceAfter: 5000, description: 'Bounty payment: Build E2E tests', createdAt: '2026-04-25T10:00:00.000Z', bountyId: 'bty_01J8K4M6N7P9Q2R3S5T6U7V8W', taskId: null },
  { id: 'txn_02', workspaceId: MOCK_WORKSPACE_ID, type: 'credit', amount: 500, balanceAfter: 5300, description: 'Bounty reward received', createdAt: '2026-04-24T15:00:00.000Z', bountyId: null, taskId: null },
  { id: 'txn_03', workspaceId: MOCK_WORKSPACE_ID, type: 'debit', amount: 250, balanceAfter: 4800, description: 'Bounty payment: Implement Zustand stores', createdAt: '2026-04-23T14:00:00.000Z', bountyId: 'bty_01J8K4M6N7P9Q2R3S5T6U8A1', taskId: null },
  { id: 'txn_04', workspaceId: MOCK_WORKSPACE_ID, type: 'credit', amount: 1000, balanceAfter: 5050, description: 'Monthly credit allocation', createdAt: '2026-04-01T00:00:00.000Z', bountyId: null, taskId: null },
  { id: 'txn_05', workspaceId: MOCK_WORKSPACE_ID, type: 'debit', amount: 150, balanceAfter: 4050, description: 'Bounty payment: Fix TypeScript errors', createdAt: '2026-04-20T11:00:00.000Z', bountyId: 'bty_01J8K4M6N7P9Q2R3S5T6U8B2', taskId: null },
];

export const creditsHandlers = [
  // GET /a2a/credits
  http.get('/a2a/credits', async () => {
    await delay(150);
    return HttpResponse.json(mockCredits);
  }),

  // GET /a2a/credits/history
  http.get('/a2a/credits/history', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const paginated = mockCreditsHistory.slice(offset, offset + limit);
    return HttpResponse.json({ transactions: paginated, total: mockCreditsHistory.length, offset, limit });
  }),

  // POST /a2a/credits/transfer
  http.post('/a2a/credits/transfer', async ({ request }) => {
    await delay(300);
    const body = await request.json() as { to: string; amount: number; description?: string };
    if (!body.to || !body.amount || body.amount <= 0) {
      return HttpResponse.json({ error: 'VALIDATION_ERROR', message: 'Invalid transfer parameters' }, { status: 400 });
    }
    if (body.amount > mockCredits.balance) {
      return HttpResponse.json({ error: 'INSUFFICIENT_BALANCE', message: 'Not enough credits' }, { status: 400 });
    }
    return HttpResponse.json({
      id: `txn_${Date.now().toString(36)}`,
      workspaceId: MOCK_WORKSPACE_ID,
      type: 'debit',
      amount: body.amount,
      balanceAfter: mockCredits.balance - body.amount,
      description: body.description || `Transfer to ${body.to}`,
      createdAt: new Date().toISOString(),
      to: body.to,
    }, { status: 201 });
  }),
];

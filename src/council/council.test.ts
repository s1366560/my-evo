/**
 * Council Module Unit Tests
 * Tests proposal CRUD, voting logic, and tallying.
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fastify, { type FastifyInstance } from 'fastify';
import * as councilService from './service';
import { COUNCIL_CONFIG } from './types';
import { councilRoutes } from './routes';

// ============================================================
// In-memory mock data
// ============================================================

interface MockProposal {
  proposal_id: string;
  title: string;
  description: string;
  status: string;
  category: string;
  proposer_id: string;
  deposit: number;
  seconds: string[];
  discussion_deadline: Date | null;
  voting_deadline: Date | null;
  execution_result: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MockVote {
  id: number;
  voter_id: string;
  proposal_id: string;
  decision: string;
  weight: number;
  reason: string | null;
  cast_at: Date;
}

interface MockNode {
  node_id: string;
  reputation: number;
  credit_balance: number;
}

let proposals: MockProposal[] = [];
let votes: MockVote[] = [];
let nodes: MockNode[] = [];
let creditTxs: { node_id: string; amount: number; type: string }[] = [];
let voteIdSeq = 1;

function resetState(): void {
  proposals = [];
  votes = [];
  creditTxs = [];
  voteIdSeq = 1;
  nodes = [
    { node_id: 'n_rep', reputation: 65, credit_balance: 500 },
    { node_id: 'n_low', reputation: 5, credit_balance: 500 },
    { node_id: 'n_hi', reputation: 85, credit_balance: 200 },
    { node_id: 'n_poor', reputation: 40, credit_balance: 10 },
    { node_id: 'n_voter', reputation: 30, credit_balance: 100 },
  ];
}

// ============================================================
// Mock Prisma client
// ============================================================

function makeProposal(now: Date, id: string, overrides: Partial<MockProposal> = {}): MockProposal {
  return {
    proposal_id: id, title: 'T', description: 'D', status: 'draft',
    category: 'protocol', proposer_id: 'n_rep', deposit: 50, seconds: [],
    discussion_deadline: null, voting_deadline: now, execution_result: null,
    created_at: now, updated_at: now, ...overrides,
  };
}

function votesFor(pid: string): MockVote[] {
  return votes.filter(v => v.proposal_id === pid);
}

const mp = {
  proposal: {
    findMany: jest.fn(async (o: any) => {
      let r = [...proposals];
      if (o.where?.status) r = r.filter(p => p.status === o.where.status);
      r.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      if (o.skip) r = r.slice(o.skip);
      if (o.take) r = r.slice(0, o.take);
      return r.map(p => ({ ...p, votes: votesFor(p.proposal_id) }));
    }),
    findUnique: jest.fn(async (o: any) => {
      const p = proposals.find(x => x.proposal_id === o.where.proposal_id);
      return p ? { ...p, votes: votesFor(p.proposal_id) } : null;
    }),
    count: jest.fn(async (o: any) => {
      let r = [...proposals];
      if (o.where?.status) r = r.filter(p => p.status === o.where.status);
      return r.length;
    }),
    create: jest.fn(async ({ data }: any) => {
      const now = new Date();
      const p: MockProposal = { created_at: now, updated_at: now, status: 'draft', deposit: 50, seconds: [], discussion_deadline: null, voting_deadline: null, execution_result: null, ...data };
      proposals.push(p);
      return { ...p, votes: [] };
    }),
    update: jest.fn(async (o: any) => {
      const idx = proposals.findIndex(p => p.proposal_id === o.where.proposal_id);
      if (idx === -1) throw new Error('Not found');
      proposals[idx] = { ...proposals[idx], ...o.data, updated_at: new Date() };
      return { ...proposals[idx]!, votes: votesFor(proposals[idx]!.proposal_id) };
    }),
  },
  proposalVote: {
    findUnique: jest.fn(async (o: any) => {
      const k = o.where.voter_id_proposal_id;
      return votes.find(v => v.voter_id === k.voter_id && v.proposal_id === k.proposal_id) || null;
    }),
    create: jest.fn(async ({ data }: any) => {
      const v: MockVote = { ...data, id: voteIdSeq++, cast_at: data.cast_at || new Date() };
      votes.push(v);
      return v;
    }),
    update: jest.fn(async (o: any) => {
      const idx = votes.findIndex(v => v.id === o.where.id);
      if (idx === -1) throw new Error('Not found');
      votes[idx] = { ...votes[idx], ...o.data };
      return votes[idx];
    }),
  },
  node: {
    findUnique: jest.fn(async (o: any) => nodes.find(n => n.node_id === o.where.node_id) || null),
    update: jest.fn(async (o: any) => {
      const idx = nodes.findIndex(n => n.node_id === o.where.node_id);
      if (idx === -1) throw new Error('Node not found');
      if (o.data.credit_balance?.decrement) nodes[idx]!.credit_balance -= o.data.credit_balance.decrement;
      if (o.data.credit_balance?.increment) nodes[idx]!.credit_balance += o.data.credit_balance.increment;
      return nodes[idx];
    }),
  },
  creditTransaction: {
    create: jest.fn(async ({ data }: any) => { creditTxs.push(data); return data; }),
  },
} as any;

// ============================================================
// Tests
// ============================================================

describe('Council Service', () => {
  beforeEach(() => { resetState(); jest.clearAllMocks(); });

  // ── listProposals ──
  describe('listProposals', () => {
    it('returns empty when no proposals', async () => {
      const r = await councilService.listProposals(mp);
      expect(r.proposals).toHaveLength(0);
      expect(r.total).toBe(0);
    });

    it('returns proposals with pagination', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'p1'), makeProposal(now, 'p2', { status: 'active' }));
      const r = await councilService.listProposals(mp, { limit: 10 });
      expect(r.proposals).toHaveLength(2);
      expect(r.total).toBe(2);
    });

    it('filters by status', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pd', { status: 'draft' }));
      proposals.push(makeProposal(now, 'pa', { status: 'active' }));
      const r = await councilService.listProposals(mp, { status: 'active' });
      expect(r.proposals).toHaveLength(1);
      expect(r.proposals[0]!.status).toBe('active');
    });
  });

  // ── getProposal ──
  describe('getProposal', () => {
    it('returns null for non-existent', async () => {
      expect(await councilService.getProposal(mp, 'nope')).toBeNull();
    });

    it('returns proposal with votes and stats', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pv', { status: 'active' }));
      votes.push({ id: 1, voter_id: 'v1', proposal_id: 'pv', decision: 'approve', weight: 2, reason: null, cast_at: now });
      votes.push({ id: 2, voter_id: 'v2', proposal_id: 'pv', decision: 'reject', weight: 1, reason: null, cast_at: now });
      const r = await councilService.getProposal(mp, 'pv');
      expect(r).not.toBeNull();
      expect((r as any).votes).toHaveLength(2);
      expect(r!.approval_rate).toBe(66.67);
    });
  });

  // ── createProposal ──
  describe('createProposal', () => {
    it('creates draft and deducts deposit', async () => {
      const r = await councilService.createProposal(mp, {
        proposer_id: 'n_rep', title: 'Test', description: 'A test proposal body', category: 'protocol',
      });
      expect(r.status).toBe('draft');
      expect(r.proposer_id).toBe('n_rep');
      expect(nodes.find(n => n.node_id === 'n_rep')!.credit_balance).toBe(450);
    });

    it('rejects low reputation', async () => {
      await expect(councilService.createProposal(mp, {
        proposer_id: 'n_low', title: 'X', description: 'desc', category: 'protocol',
      })).rejects.toThrow();
    });

    it('rejects insufficient credits', async () => {
      await expect(councilService.createProposal(mp, {
        proposer_id: 'n_poor', title: 'X', description: 'desc', category: 'protocol',
      })).rejects.toThrow();
    });

    it('rejects unknown node', async () => {
      await expect(councilService.createProposal(mp, {
        proposer_id: 'ghost', title: 'X', description: 'desc', category: 'protocol',
      })).rejects.toThrow();
    });
  });

  // ── secondProposal ──
  describe('secondProposal', () => {
    it('seconds a draft', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'ps'));
      const r = await councilService.secondProposal(mp, 'ps', 'n_hi');
      expect(r.success).toBe(true);
      expect(r.seconds).toContain('n_hi');
    });

    it('rejects unknown proposal', async () => {
      await expect(councilService.secondProposal(mp, 'nope', 'n_rep')).rejects.toThrow();
    });

    it('rejects non-draft', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'ps2', { status: 'active' }));
      await expect(councilService.secondProposal(mp, 'ps2', 'n_hi')).rejects.toThrow();
    });

    it('rejects self-second', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'ps3', { proposer_id: 'n_rep' }));
      await expect(councilService.secondProposal(mp, 'ps3', 'n_rep')).rejects.toThrow();
    });

    it('rejects double second', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'ps4', { seconds: ['n_hi'] }));
      await expect(councilService.secondProposal(mp, 'ps4', 'n_hi')).rejects.toThrow();
    });
  });

  // ── activateProposal ──
  describe('activateProposal', () => {
    it('activates with enough seconds', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pa1', { seconds: ['s1', 's2', 's3'] }));
      const r = await councilService.activateProposal(mp, 'pa1', 'n_rep');
      expect(r.status).toBe('active');
    });

    it('rejects not enough seconds', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pa2', { seconds: ['s1'] }));
      await expect(councilService.activateProposal(mp, 'pa2', 'n_rep')).rejects.toThrow();
    });

    it('rejects non-proposer', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pa3', { seconds: ['s1', 's2', 's3'] }));
      await expect(councilService.activateProposal(mp, 'pa3', 'n_hi')).rejects.toThrow();
    });
  });

  // ── castVote ──
  describe('castVote', () => {
    it('casts approve on active proposal', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv1', { status: 'active', voting_deadline: dl }));
      const r = await councilService.castVote(mp, {
        voter_id: 'n_voter', proposal_id: 'pv1', decision: 'approve',
      });
      expect(r.decision).toBe('approve');
      expect(r.voter_id).toBe('n_voter');
    });

    it('casts reject vote', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv2', { status: 'active', voting_deadline: dl }));
      const r = await councilService.castVote(mp, {
        voter_id: 'n_voter', proposal_id: 'pv2', decision: 'reject',
      });
      expect(r.decision).toBe('reject');
    });

    it('updates existing vote (upsert)', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv3', { status: 'active', voting_deadline: dl }));
      await councilService.castVote(mp, { voter_id: 'n_voter', proposal_id: 'pv3', decision: 'approve' });
      const r = await councilService.castVote(mp, { voter_id: 'n_voter', proposal_id: 'pv3', decision: 'reject' });
      expect(r.decision).toBe('reject');
      expect(votes.filter(v => v.proposal_id === 'pv3' && v.voter_id === 'n_voter')).toHaveLength(1);
    });

    it('rejects vote on non-active proposal', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pv4', { status: 'draft' }));
      await expect(councilService.castVote(mp, {
        voter_id: 'n_voter', proposal_id: 'pv4', decision: 'approve',
      })).rejects.toThrow();
    });

    it('rejects low reputation voter', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv5', { status: 'active', voting_deadline: dl }));
      await expect(councilService.castVote(mp, {
        voter_id: 'n_low', proposal_id: 'pv5', decision: 'approve',
      })).rejects.toThrow();
    });
  });

  // ── finalizeProposal ──
  describe('finalizeProposal', () => {
    it('passes when approve > reject', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pf1', { status: 'active' }));
      votes.push({ id: 1, voter_id: 'v1', proposal_id: 'pf1', decision: 'approve', weight: 2, reason: null, cast_at: now });
      votes.push({ id: 2, voter_id: 'v2', proposal_id: 'pf1', decision: 'reject', weight: 1, reason: null, cast_at: now });
      const r = await councilService.finalizeProposal(mp, 'pf1');
      expect(r.status).toBe('passed');
    });

    it('rejects when reject >= approve', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pf2', { status: 'active' }));
      votes.push({ id: 3, voter_id: 'v1', proposal_id: 'pf2', decision: 'reject', weight: 3, reason: null, cast_at: now });
      const r = await councilService.finalizeProposal(mp, 'pf2');
      expect(r.status).toBe('rejected');
    });

    it('refunds deposit on pass', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pf3', { status: 'active', proposer_id: 'n_rep', deposit: 50 }));
      votes.push({ id: 4, voter_id: 'v1', proposal_id: 'pf3', decision: 'approve', weight: 2, reason: null, cast_at: now });
      const before = nodes.find(n => n.node_id === 'n_rep')!.credit_balance;
      await councilService.finalizeProposal(mp, 'pf3');
      expect(nodes.find(n => n.node_id === 'n_rep')!.credit_balance).toBe(before + 50);
    });

    it('rejects finalize of non-active', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pf4', { status: 'draft' }));
      await expect(councilService.finalizeProposal(mp, 'pf4')).rejects.toThrow();
    });
  });

  // ── cancelProposal ──
  describe('cancelProposal', () => {
    it('cancels draft and refunds deposit', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pc1', { proposer_id: 'n_rep', deposit: 50 }));
      const before = nodes.find(n => n.node_id === 'n_rep')!.credit_balance;
      const r = await councilService.cancelProposal(mp, 'pc1', 'n_rep');
      expect(r.status).toBe('cancelled');
      expect(nodes.find(n => n.node_id === 'n_rep')!.credit_balance).toBe(before + 50);
    });

    it('rejects non-proposer cancel', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pc2', { proposer_id: 'n_rep' }));
      await expect(councilService.cancelProposal(mp, 'pc2', 'n_hi')).rejects.toThrow();
    });

    it('rejects cancel of non-draft', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pc3', { status: 'active', proposer_id: 'n_rep' }));
      await expect(councilService.cancelProposal(mp, 'pc3', 'n_rep')).rejects.toThrow();
    });
  });
});

// ============================================================
// HTTP E2E Route Tests
// ============================================================

// Mock auth module to bypass real DB auth
jest.mock('../shared/auth', () => ({
  requireNodeSecretAuth: () => async (request: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      const err: any = new Error('Unauthorized');
      err.statusCode = 401;
      throw err;
    }
    request.auth = {
      node_id: 'n_rep',
      auth_type: 'node_secret' as const,
      trust_level: 'trusted' as const,
    };
  },
}));

function buildRouteApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', mp as any);
  return app;
}

describe('Council E2E Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetState();
    jest.clearAllMocks();
    app = buildRouteApp();
    await app.register(councilRoutes, { prefix: '/a2a/council' });
    await app.ready();
  });

  afterEach(async () => { await app.close(); });

  const AUTH = { authorization: 'Bearer ns_testsecret' };

  // ── GET /history ──
  describe('GET /a2a/council/history', () => {
    it('returns empty list with 200', async () => {
      const res = await app.inject({ method: 'GET', url: '/a2a/council/history' });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.proposals).toEqual([]);
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBe(0);
    });

    it('returns proposals with status filter', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'p1', { status: 'active' }));
      proposals.push(makeProposal(now, 'p2', { status: 'draft' }));
      const res = await app.inject({
        method: 'GET', url: '/a2a/council/history?status=active',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.proposals).toHaveLength(1);
      expect(body.proposals[0].status).toBe('active');
    });

    it('respects limit and offset', async () => {
      const now = new Date();
      for (let i = 0; i < 5; i++) proposals.push(makeProposal(now, `pl${i}`));
      const res = await app.inject({
        method: 'GET', url: '/a2a/council/history?limit=2&offset=0',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.meta.total).toBe(5);
      expect(body.proposals).toHaveLength(2);
    });
  });

  // ── GET /proposal/:proposalId ──
  describe('GET /a2a/council/proposal/:proposalId', () => {
    it('returns 404 for missing proposal', async () => {
      const res = await app.inject({
        method: 'GET', url: '/a2a/council/proposal/nonexist',
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns proposal with votes', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pv', { status: 'active' }));
      votes.push({
        id: 1, voter_id: 'v1', proposal_id: 'pv',
        decision: 'approve', weight: 2, reason: null, cast_at: now,
      });
      const res = await app.inject({
        method: 'GET', url: '/a2a/council/proposal/pv',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.proposal.proposal_id).toBe('pv');
      expect(body.votes).toHaveLength(1);
      expect(body.votes[0].decision).toBe('approve');
    });
  });

  // ── POST /proposal ──
  describe('POST /a2a/council/proposal', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal',
        payload: { title: 'Test', description: 'A valid description body', category: 'protocol' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('creates draft proposal with 201', async () => {
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal',
        headers: AUTH,
        payload: {
          title: 'Test Proposal',
          description: 'A test proposal description body',
          category: 'protocol',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.proposal.status).toBe('draft');
      expect(body.proposal.proposer_id).toBe('n_rep');
      expect(body.message).toBe('Proposal created in draft status');
    });

    it('rejects invalid category with 400', async () => {
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal',
        headers: AUTH,
        payload: {
          title: 'Bad Cat',
          description: 'Invalid category test',
          category: 'invalid_cat',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(false);
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  // ── POST /proposal/:proposalId/vote ──
  describe('POST /a2a/council/proposal/:proposalId/vote', () => {
    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/p1/vote',
        payload: { vote: 'approve' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('casts approve vote on active proposal', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv1', { status: 'active', voting_deadline: dl }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pv1/vote',
        headers: AUTH,
        payload: { vote: 'approve', reason: 'Good idea' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.vote.decision).toBe('approve');
      expect(body.vote.voter_id).toBe('n_rep');
    });

    it('casts reject vote', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv2', { status: 'active', voting_deadline: dl }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pv2/vote',
        headers: AUTH,
        payload: { vote: 'reject' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.vote.decision).toBe('reject');
    });

    it('casts abstain vote', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pv3', { status: 'active', voting_deadline: dl }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pv3/vote',
        headers: AUTH,
        payload: { vote: 'abstain' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.vote.decision).toBe('abstain');
    });
  });

  // ── POST /proposal/:proposalId/second ──
  describe('POST /a2a/council/proposal/:proposalId/second', () => {
    it('seconds a draft proposal', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'ps1', { proposer_id: 'n_other' }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/ps1/second',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });
  });

  // ── POST /proposal/:proposalId/activate ──
  describe('POST /a2a/council/proposal/:proposalId/activate', () => {
    it('activates proposal with enough seconds', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pa1', {
        seconds: ['s1', 's2', 's3'],
      }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pa1/activate',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.proposal.status).toBe('active');
    });
  });

  // ── POST /proposal/:proposalId/finalize ──
  describe('POST /a2a/council/proposal/:proposalId/finalize', () => {
    it('finalizes active proposal as passed', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pf1', { status: 'active' }));
      votes.push({
        id: 1, voter_id: 'v1', proposal_id: 'pf1',
        decision: 'approve', weight: 2, reason: null, cast_at: now,
      });
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pf1/finalize',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.proposal.status).toBe('passed');
    });

    it('finalizes as rejected when more reject weight', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pf2', { status: 'active' }));
      votes.push({
        id: 2, voter_id: 'v1', proposal_id: 'pf2',
        decision: 'reject', weight: 5, reason: null, cast_at: now,
      });
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pf2/finalize',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.proposal.status).toBe('rejected');
    });
  });

  // ── POST /proposal/:proposalId/cancel ──
  describe('POST /a2a/council/proposal/:proposalId/cancel', () => {
    it('cancels own draft proposal', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pc1', { proposer_id: 'n_rep' }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pc1/cancel',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.proposal.status).toBe('cancelled');
    });
  });

  // ── Response shape verification ──
  describe('Response shapes match types.ts', () => {
    it('CouncilProposalsResponse shape', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pshape'));
      const res = await app.inject({
        method: 'GET', url: '/a2a/council/history',
      });
      const body = JSON.parse(res.payload);
      // Must have proposals array and meta object
      expect(Array.isArray(body.proposals)).toBe(true);
      expect(typeof body.meta.total).toBe('number');
      expect(typeof body.meta.limit).toBe('number');
      expect(typeof body.meta.offset).toBe('number');
      // ProposalSummary fields
      const p = body.proposals[0];
      expect(typeof p.proposal_id).toBe('string');
      expect(typeof p.title).toBe('string');
      expect(typeof p.description).toBe('string');
      expect(typeof p.status).toBe('string');
      expect(typeof p.category).toBe('string');
      expect(typeof p.proposer_id).toBe('string');
      expect(typeof p.votes_for).toBe('number');
      expect(typeof p.votes_against).toBe('number');
      expect(typeof p.votes_abstain).toBe('number');
      expect(typeof p.deposit).toBe('number');
      expect(typeof p.created_at).toBe('string');
      expect(typeof p.updated_at).toBe('string');
    });

    it('ProposalDetailsResponse shape', async () => {
      const now = new Date();
      proposals.push(makeProposal(now, 'pdetail', { status: 'active' }));
      const res = await app.inject({
        method: 'GET', url: '/a2a/council/proposal/pdetail',
      });
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(typeof body.proposal.proposal_id).toBe('string');
      expect(Array.isArray(body.proposal.seconds)).toBe(true);
      expect(Array.isArray(body.votes)).toBe(true);
      // ProposalWithStats extra fields
      expect(typeof body.proposal.total_votes).toBe('number');
      expect(typeof body.proposal.approval_rate).toBe('number');
      expect(typeof body.proposal.voter_count).toBe('number');
    });

    it('CastVoteResponse shape', async () => {
      const now = new Date();
      const dl = new Date(now.getTime() + 86400000);
      proposals.push(makeProposal(now, 'pvshape', { status: 'active', voting_deadline: dl }));
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal/pvshape/vote',
        headers: AUTH,
        payload: { vote: 'approve' },
      });
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(typeof body.vote.voter_id).toBe('string');
      expect(typeof body.vote.proposal_id).toBe('string');
      expect(['approve', 'reject', 'abstain']).toContain(body.vote.decision);
      expect(typeof body.vote.weight).toBe('number');
      expect(typeof body.vote.cast_at).toBe('string');
    });

    it('CreateProposalResponse shape', async () => {
      const res = await app.inject({
        method: 'POST', url: '/a2a/council/proposal',
        headers: AUTH,
        payload: {
          title: 'Shape Test',
          description: 'Verify response shape matches types',
          category: 'governance',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(typeof body.proposal.proposal_id).toBe('string');
      expect(typeof body.message).toBe('string');
    });
  });
});

import fastify, { type FastifyInstance } from 'fastify';
import { councilRoutes } from './routes';

const mockCreateProposal = jest.fn();
const mockSecondProposal = jest.fn();
const mockVote = jest.fn();
const mockExecuteDecision = jest.fn();
const mockListProposals = jest.fn();
const mockGetProposal = jest.fn();
const mockGetVotes = jest.fn();
const mockGenerateDialogResponse = jest.fn();
const mockResolveEscalatedDispute = jest.fn();
let mockAuth = {
  node_id: 'node-7',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  createProposal: (...args: unknown[]) => mockCreateProposal(...args),
  secondProposal: (...args: unknown[]) => mockSecondProposal(...args),
  vote: (...args: unknown[]) => mockVote(...args),
  executeDecision: (...args: unknown[]) => mockExecuteDecision(...args),
  listProposals: (...args: unknown[]) => mockListProposals(...args),
  getProposal: (...args: unknown[]) => mockGetProposal(...args),
  getVotes: (...args: unknown[]) => mockGetVotes(...args),
  generateDialogResponse: (...args: unknown[]) => mockGenerateDialogResponse(...args),
}));

jest.mock('../dispute/service', () => ({
  resolveEscalatedDispute: (...args: unknown[]) => mockResolveEscalatedDispute(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string; auth_type: string } }) => {
    request.auth = {
      node_id: mockAuth.node_id,
      auth_type: mockAuth.auth_type,
    };
  },
  requireTrustLevel: () => async (
    request: {
      auth?: { node_id: string; auth_type: string; trust_level: string };
    },
  ) => {
    request.auth = {
      node_id: mockAuth.node_id,
      auth_type: mockAuth.auth_type,
      trust_level: mockAuth.trust_level,
    };
  },
}));

function buildApp(prisma: unknown = {}): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Council routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = {
      node_id: 'node-7',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    mockCreateProposal.mockResolvedValue({ proposal_id: 'prop-1', status: 'draft' });
    mockSecondProposal.mockResolvedValue({ proposal_id: 'prop-1', status: 'seconded' });
    mockVote.mockResolvedValue({ proposal_id: 'prop-1', voter_id: 'node-7', decision: 'approve', weight: 1.2 });
    mockExecuteDecision.mockResolvedValue({ proposal_id: 'prop-1', status: 'executed' });
    mockListProposals.mockResolvedValue({ proposals: [{ proposal_id: 'prop-1', status: 'draft' }], total: 1, limit: 20, offset: 0 });
    mockGetProposal.mockResolvedValue({ proposal_id: 'prop-1', status: 'draft' });
    mockGetVotes.mockResolvedValue([{ voter_id: 'node-7', decision: 'approve' }]);
  });

  it('passes dialog input to the service', async () => {
    const app = buildApp();
    mockGenerateDialogResponse.mockResolvedValue({
      proposal_id: 'prop-1',
      speaker: 'node-7',
      message: 'Please clarify quorum risk.',
      response: {
        summary: 'Voting is active, but quorum is not met yet.',
        positions: [],
        consensus_estimate: 0.5,
        recommended_action: 'Increase participation.',
      },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    try {
      await app.register(councilRoutes, { prefix: '/a2a/council' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/a2a/council/dialog',
        payload: {
          proposal_id: 'prop-1',
          message: 'Please clarify quorum risk.',
          context: { source: 'route-test' },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGenerateDialogResponse).toHaveBeenCalledWith({
        proposal_id: 'prop-1',
        speaker_id: 'node-7',
        message: 'Please clarify quorum risk.',
        context: { source: 'route-test' },
      });
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        dialogue: {
          proposal_id: 'prop-1',
          speaker: 'node-7',
          message: 'Please clarify quorum risk.',
          response: {
            summary: 'Voting is active, but quorum is not met yet.',
            positions: [],
            consensus_estimate: 0.5,
            recommended_action: 'Increase participation.',
          },
          timestamp: '2026-01-01T00:00:00.000Z',
        },
        data: {
          proposal_id: 'prop-1',
          speaker: 'node-7',
          message: 'Please clarify quorum risk.',
          response: {
            summary: 'Voting is active, but quorum is not met yet.',
            positions: [],
            consensus_estimate: 0.5,
            recommended_action: 'Increase participation.',
          },
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      });
    } finally {
      await app.close();
    }
  });

  it('rejects dialog requests without a message', async () => {
    const app = buildApp();

    try {
      await app.register(councilRoutes, { prefix: '/a2a/council' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/a2a/council/dialog',
        payload: {
          proposal_id: 'prop-1',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockGenerateDialogResponse).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('resolves escalated disputes through the council compatibility route', async () => {
    const app = buildApp({
      dispute: {
        findUnique: jest.fn().mockResolvedValue({
          dispute_id: 'dsp-1',
          plaintiff_id: 'node-plaintiff',
          defendant_id: 'node-defendant',
        }),
      },
    });
    mockResolveEscalatedDispute.mockResolvedValue({
      dispute_id: 'dsp-1',
      status: 'resolved',
    });

    try {
      await app.register(councilRoutes, { prefix: '/a2a/council' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/a2a/council/resolve-dispute',
        payload: {
          dispute_id: 'dsp-1',
          resolution: 'defendant_penalized',
          penalty: {
            reputation_deduction: 15,
            credit_fine: 100,
            quarantine_level: 'L1',
          },
          compensation: {
            credit_amount: 80,
            reputation_restore: 5,
          },
          reasoning: 'Asset behavior materially diverged from its claims.',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockResolveEscalatedDispute).toHaveBeenCalledWith(
        'dsp-1',
        expect.objectContaining({
          dispute_id: 'dsp-1',
          verdict: 'plaintiff_wins',
          penalties: [expect.objectContaining({
            target_node_id: 'node-defendant',
            reputation_deduction: 15,
            credit_fine: 100,
            quarantine_level: 'L1',
          })],
          compensations: [expect.objectContaining({
            recipient_node_id: 'node-plaintiff',
            credit_amount: 80,
            reputation_restore: 5,
          })],
          votes: [expect.objectContaining({
            arbitrator_id: 'node-7',
            vote: 'plaintiff',
          })],
        }),
        'node-7',
      );
      expect(JSON.parse(response.payload)).toEqual({
        success: true,
        status: 'ok',
        dispute_id: 'dsp-1',
        resolution: 'defendant_penalized',
        executed_actions: [
          'reputation_deducted: -15',
          'credits_fined: -100',
          'quarantine_applied: L1 (24h)',
          'compensation_paid: +80 credits to node-plaintiff',
          'reputation_restored: +5 to node-plaintiff',
        ],
      });
    } finally {
      await app.close();
    }
  });

  it('exposes top-level aliases for proposal, vote, execute, config, and history surfaces', async () => {
    const app = buildApp({
      proposal: {
        findFirst: jest.fn().mockResolvedValue({
          created_at: '2026-04-01T00:00:00.000Z',
          voting_deadline: '2026-04-02T00:00:00.000Z',
          status: 'voting',
        }),
        findMany: jest.fn().mockResolvedValue([
          { proposal_id: 'prop-1', status: 'approved', updated_at: '2026-04-01T00:00:00.000Z', votes: [] },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
    });

    try {
      await app.register(councilRoutes, { prefix: '/a2a/council' });
      await app.ready();

      const responses = await Promise.all([
        app.inject({
          method: 'POST',
          url: '/a2a/council/propose',
          payload: { title: 'T', description: 'D', category: 'parameter_change' },
        }),
        app.inject({
          method: 'POST',
          url: '/a2a/council/proposal/prop-1/second',
        }),
        app.inject({
          method: 'POST',
          url: '/a2a/council/proposal/prop-1/vote',
          payload: { decision: 'approve' },
        }),
        app.inject({
          method: 'POST',
          url: '/a2a/council/vote',
          payload: { proposal_id: 'prop-1', vote: 'approve' },
        }),
        app.inject({
          method: 'POST',
          url: '/a2a/council/proposal/prop-1/execute',
        }),
        app.inject({
          method: 'POST',
          url: '/a2a/council/execute',
          payload: { proposal_id: 'prop-1' },
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/proposals',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/proposal/prop-1',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/proposal/prop-1/votes',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/config',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/history',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/term/current',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/term/history',
        }),
        app.inject({
          method: 'GET',
          url: '/a2a/council/prop-1',
        }),
      ]);

      expect(responses.map((r) => r.statusCode)).toEqual([201, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]);
      expect(JSON.parse(responses[0]!.payload)).toEqual({
        success: true,
        proposal: { proposal_id: 'prop-1', status: 'draft' },
        data: { proposal_id: 'prop-1', status: 'draft' },
      });
      expect(JSON.parse(responses[1]!.payload)).toEqual({
        success: true,
        proposal: { proposal_id: 'prop-1', status: 'seconded' },
        data: { proposal_id: 'prop-1', status: 'seconded' },
      });
      expect(JSON.parse(responses[2]!.payload)).toEqual({
        success: true,
        vote: { proposal_id: 'prop-1', voter_id: 'node-7', decision: 'approve', weight: 1.2 },
        data: { proposal_id: 'prop-1', voter_id: 'node-7', decision: 'approve', weight: 1.2 },
      });
      expect(JSON.parse(responses[3]!.payload)).toEqual({
        success: true,
        vote: { proposal_id: 'prop-1', voter_id: 'node-7', decision: 'approve', weight: 1.2 },
        data: { proposal_id: 'prop-1', voter_id: 'node-7', decision: 'approve', weight: 1.2 },
      });
      expect(JSON.parse(responses[4]!.payload)).toEqual({
        success: true,
        result: { proposal_id: 'prop-1', status: 'executed' },
        data: { proposal_id: 'prop-1', status: 'executed' },
      });
      expect(JSON.parse(responses[5]!.payload)).toEqual({
        success: true,
        result: { proposal_id: 'prop-1', status: 'executed' },
        data: { proposal_id: 'prop-1', status: 'executed' },
      });
      expect(JSON.parse(responses[6]!.payload)).toEqual({
        success: true,
        proposals: [{ proposal_id: 'prop-1', status: 'draft' }],
        total: 1,
        data: [{ proposal_id: 'prop-1', status: 'draft' }],
        meta: { total: 1, limit: 20, offset: 0 },
      });
      expect(JSON.parse(responses[7]!.payload)).toEqual({
        success: true,
        proposal: { proposal_id: 'prop-1', status: 'draft' },
        data: { proposal_id: 'prop-1', status: 'draft' },
      });
      expect(JSON.parse(responses[8]!.payload)).toEqual({
        success: true,
        votes: [{ voter_id: 'node-7', decision: 'approve' }],
        total: 1,
        data: [{ voter_id: 'node-7', decision: 'approve' }],
      });
      expect(JSON.parse(responses[9]!.payload)).toEqual({
        success: true,
        config: {
          voting_period_hours: 72,
          min_quorum_pct: 0.3,
          min_approval_pct: 60,
          max_council_members: 9,
          min_gdi_to_vote: 80,
        },
        data: {
          voting_period_hours: 72,
          min_quorum_pct: 0.3,
          min_approval_pct: 60,
          max_council_members: 9,
          min_gdi_to_vote: 80,
        },
      });
      expect(JSON.parse(responses[10]!.payload)).toEqual({
        success: true,
        proposals: [{ proposal_id: 'prop-1', status: 'approved', updated_at: '2026-04-01T00:00:00.000Z', votes: [] }],
        total: 1,
        data: [{ proposal_id: 'prop-1', status: 'approved', updated_at: '2026-04-01T00:00:00.000Z', votes: [] }],
        meta: { total: 1, limit: 20, offset: 0 },
      });
      expect(JSON.parse(responses[11]!.payload)).toEqual({
        success: true,
        term: {
          term_id: expect.any(String),
          started_at: '2026-04-01T00:00:00.000Z',
          ends_at: '2026-04-02T00:00:00.000Z',
          active_proposals: 1,
          current_status: 'voting',
        },
        data: {
          term_id: expect.any(String),
          started_at: '2026-04-01T00:00:00.000Z',
          ends_at: '2026-04-02T00:00:00.000Z',
          active_proposals: 1,
          current_status: 'voting',
        },
      });
      expect(JSON.parse(responses[12]!.payload)).toEqual({
        success: true,
        terms: [{ term_id: 'term-2026-q2', approved: 1, rejected: 0, total: 1, period_start: '', period_end: '' }],
        total: 1,
        data: [{ term_id: 'term-2026-q2', approved: 1, rejected: 0, total: 1, period_start: '', period_end: '' }],
        meta: { total: 1 },
      });
      expect(JSON.parse(responses[13]!.payload)).toEqual({
        success: true,
        proposal: { proposal_id: 'prop-1', status: 'draft' },
        data: { proposal_id: 'prop-1', status: 'draft' },
      });
    } finally {
      await app.close();
    }
  });

  it('rejects session-authenticated dispute resolution requests', async () => {
    mockAuth = {
      node_id: 'node-7',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    const app = buildApp({
      dispute: {
        findUnique: jest.fn(),
      },
    });

    try {
      await app.register(councilRoutes, { prefix: '/a2a/council' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/a2a/council/resolve-dispute',
        payload: {
          dispute_id: 'dsp-1',
          resolution: 'defendant_penalized',
          reasoning: 'Needs council-only auth.',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(mockResolveEscalatedDispute).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it('rejects api-key dispute resolution requests even when trusted', async () => {
    mockAuth = {
      node_id: 'node-7',
      auth_type: 'api_key',
      trust_level: 'trusted',
    };
    const app = buildApp({
      dispute: {
        findUnique: jest.fn(),
      },
    });

    try {
      await app.register(councilRoutes, { prefix: '/a2a/council' });
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/a2a/council/resolve-dispute',
        payload: {
          dispute_id: 'dsp-1',
          resolution: 'defendant_penalized',
          reasoning: 'Needs council-only auth.',
        },
      });

      expect(response.statusCode).toBe(403);
      expect(mockResolveEscalatedDispute).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

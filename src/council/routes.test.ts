import fastify, { type FastifyInstance } from 'fastify';
import { councilRoutes } from './routes';

const mockGenerateDialogResponse = jest.fn();
const mockResolveEscalatedDispute = jest.fn();
let mockAuth = {
  node_id: 'node-7',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
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

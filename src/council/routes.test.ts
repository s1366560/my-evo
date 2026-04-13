import fastify, { type FastifyInstance } from 'fastify';
import { councilRoutes } from './routes';

const mockGenerateDialogResponse = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  generateDialogResponse: (...args: unknown[]) => mockGenerateDialogResponse(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-7' };
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
});

import fastify, { type FastifyInstance } from 'fastify';
import { constitutionRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockGetAmendment = jest.fn();
const mockVoteOnAmendment = jest.fn();
const mockRatifyAmendment = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  getAmendment: (...args: unknown[]) => mockGetAmendment(...args),
  voteOnAmendment: (...args: unknown[]) => mockVoteOnAmendment(...args),
  ratifyAmendment: (...args: unknown[]) => mockRatifyAmendment(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Constitution routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = buildApp();
    await app.register(constitutionRoutes, { prefix: '/a2a/constitution' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports plural amendment detail aliases', async () => {
    mockGetAmendment.mockResolvedValue({ amendment_id: 'amend-1', status: 'proposed' });

    const response = await app.inject({
      method: 'GET',
      url: '/a2a/constitution/amendments/amend-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetAmendment).toHaveBeenCalledWith('amend-1');
  });

  it('supports plural amendment vote aliases', async () => {
    mockVoteOnAmendment.mockResolvedValue({ amendment_id: 'amend-1', votes: [] });

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/constitution/amendments/amend-1/vote',
      payload: {
        decision: 'approve',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockVoteOnAmendment).toHaveBeenCalledWith('amend-1', 'node-1', 'approve', 1, undefined);
  });

  it('supports plural amendment ratify aliases', async () => {
    mockRatifyAmendment.mockResolvedValue({
      amendment: { amendment_id: 'amend-1', status: 'ratified' },
      new_version: { version: 2 },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/constitution/amendments/amend-1/ratify',
    });

    expect(response.statusCode).toBe(200);
    expect(mockRatifyAmendment).toHaveBeenCalledWith('amend-1');
  });
});

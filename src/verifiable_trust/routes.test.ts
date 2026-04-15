import fastify, { type FastifyInstance } from 'fastify';
import { verifiableTrustRoutes } from './routes';

let mockAuth = {
  node_id: 'trusted-node',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

const mockStake = jest.fn();
const mockRelease = jest.fn();
const mockVerifyNode = jest.fn();
const mockFailVerification = jest.fn();
const mockGetTrustLevel = jest.fn();
const mockGetStats = jest.fn();
const mockListAttestations = jest.fn();
const mockListPendingStakes = jest.fn();

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
  requireNodeSecretAuth: () => async (
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
  requireTrustLevel: () => async (
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
  stake: (...args: unknown[]) => mockStake(...args),
  release: (...args: unknown[]) => mockRelease(...args),
  verifyNode: (...args: unknown[]) => mockVerifyNode(...args),
  failVerification: (...args: unknown[]) => mockFailVerification(...args),
  getTrustLevel: (...args: unknown[]) => mockGetTrustLevel(...args),
  getStats: (...args: unknown[]) => mockGetStats(...args),
  listAttestations: (...args: unknown[]) => mockListAttestations(...args),
  listPendingStakes: (...args: unknown[]) => mockListPendingStakes(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Verifiable trust routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    mockAuth = {
      node_id: 'trusted-node',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    app = buildApp();
    await app.register(verifiableTrustRoutes, { prefix: '/trust' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts the documented verify payload fields', async () => {
    mockVerifyNode.mockResolvedValue({
      attestation_id: 'att-1',
      trust_level: 'verified',
      stake_amount: 100,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/trust/verify',
      payload: {
        target_node_id: 'node-1',
        verification_notes: 'Looks good',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'verified',
      attestation_id: 'att-1',
      reward_earned: 5,
      trust_level: 'verified',
    });
    expect(mockVerifyNode).toHaveBeenCalledWith('trusted-node', 'node-1', 'Looks good');
  });

  it('slashes the validator stake when verification_result is fail', async () => {
    mockFailVerification.mockResolvedValue({
      status: 'slashed',
      stake_id: 'stake-1',
      node_id: 'node-1',
      validator_id: 'trusted-node',
      amount_returned: 90,
      penalty: 10,
      trust_level: 'unverified',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/trust/verify',
      payload: {
        target_node_id: 'node-1',
        verification_result: 'fail',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'slashed',
      stake_id: 'stake-1',
      amount_returned: 90,
      penalty: 10,
      trust_level: 'unverified',
    });
    expect(mockFailVerification).toHaveBeenCalledWith('trusted-node', 'node-1');
  });

  it('accepts documented stake request fields and returns compatibility fields', async () => {
    mockAuth = {
      node_id: 'validator-node',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    mockStake.mockResolvedValue({
      stake_id: 'stake-1',
      node_id: 'node-1',
      validator_id: 'validator-node',
      amount: 100,
      staked_at: '2026-04-15T00:00:00Z',
      locked_until: '2026-04-22T00:00:00Z',
      status: 'active',
      attestation_id: 'att-1',
      trust_level: 'verified',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/trust/stake',
      payload: {
        target_node_id: 'node-1',
        stake_amount: 100,
        validator_id: 'validator-node',
      },
    });
    const payload = JSON.parse(response.payload);

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      stake_id: 'stake-1',
      attestation_id: 'att-1',
      trust_level: 'verified',
    });
    expect(mockStake).toHaveBeenCalledWith('node-1', 'validator-node', 100);
  });

  it('rejects non-trusted validators from stake requests before calling the service', async () => {
    mockAuth = {
      node_id: 'validator-node',
      auth_type: 'node_secret',
      trust_level: 'verified',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/trust/stake',
      payload: {
        target_node_id: 'node-1',
        stake_amount: 100,
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockStake).not.toHaveBeenCalled();
  });

  it('keeps pending stakes public', async () => {
    mockListPendingStakes.mockResolvedValue([{ stake_id: 'stake-1' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/trust/pending',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListPendingStakes).toHaveBeenCalledTimes(1);
  });

  it('returns trust level compatibility fields at the top level', async () => {
    mockGetTrustLevel.mockResolvedValue({
      node_id: 'node-1',
      trust_level: 'verified',
      attestations: [
        {
          validator_id: 'trusted-node',
          trust_level: 'verified',
          stake_amount: 100,
          verified_at: '2026-04-15T00:00:00Z',
          expires_at: '2026-05-15T00:00:00Z',
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/trust/level/node-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetTrustLevel).toHaveBeenCalledWith('node-1');
    expect(JSON.parse(response.payload)).toMatchObject({
      node_id: 'node-1',
      trust_level: 'verified',
      attestations: [
        expect.objectContaining({
          validator_id: 'trusted-node',
          trust_level: 'verified',
          stake_amount: 100,
        }),
      ],
    });
  });

  it('returns trust stats compatibility fields at the top level', async () => {
    mockGetStats.mockResolvedValue({
      total_attestations: 456,
      active_stakes: 234,
      total_staked_credits: 23400,
      verified_nodes: 189,
      trusted_validators: 23,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/trust/stats',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetStats).toHaveBeenCalledTimes(1);
    expect(JSON.parse(response.payload)).toMatchObject({
      total_attestations: 456,
      active_stakes: 234,
      total_staked_credits: 23400,
      verified_nodes: 189,
      trusted_validators: 23,
    });
  });

  it('rejects mismatched validator_id on stake requests', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/trust/stake',
      payload: {
        node_id: 'node-1',
        amount: 100,
        validator_id: 'another-node',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(mockStake).not.toHaveBeenCalled();
  });

  it('returns release compatibility fields', async () => {
    mockRelease.mockResolvedValue({
      stake_id: 'stake-1',
      node_id: 'node-1',
      validator_id: 'trusted-node',
      amount: 100,
      staked_at: '2026-04-01T00:00:00Z',
      locked_until: '2026-04-08T00:00:00Z',
      status: 'released',
      amount_returned: 90,
      penalty: 10,
      trust_level: 'unverified',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/trust/release',
      payload: { stake_id: 'stake-1' },
    });
    const payload = JSON.parse(response.payload);

    expect(response.statusCode).toBe(200);
    expect(payload).toMatchObject({
      status: 'released',
      amount_returned: 90,
      penalty: 10,
      trust_level: 'unverified',
    });
  });

  it('rejects session-authenticated trust stake operations', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };

    const [stakeResponse, verifyResponse, claimResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/trust/stake',
        payload: {
          target_node_id: 'node-1',
          stake_amount: 100,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/trust/verify',
        payload: {
          target_node_id: 'node-1',
          verification_result: 'pass',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/trust/claim',
        payload: {
          stake_id: 'stake-1',
        },
      }),
    ]);

    expect(stakeResponse.statusCode).toBe(403);
    expect(verifyResponse.statusCode).toBe(403);
    expect(claimResponse.statusCode).toBe(403);
    expect(mockStake).not.toHaveBeenCalled();
    expect(mockVerifyNode).not.toHaveBeenCalled();
  });
});

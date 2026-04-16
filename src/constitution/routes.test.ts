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
const mockListRules = jest.fn();
const mockGetRule = jest.fn();
const mockGetConstitutionVersion = jest.fn();
const mockProposeAmendment = jest.fn();
const mockListAmendments = jest.fn();
const mockCheckAmendmentCooldown = jest.fn();
const mockGetAgentEthicsProfile = jest.fn();
const mockGetViolations = jest.fn();

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
  listRules: (...args: unknown[]) => mockListRules(...args),
  getRule: (...args: unknown[]) => mockGetRule(...args),
  getConstitutionVersion: (...args: unknown[]) => mockGetConstitutionVersion(...args),
  proposeAmendment: (...args: unknown[]) => mockProposeAmendment(...args),
  listAmendments: (...args: unknown[]) => mockListAmendments(...args),
  checkAmendmentCooldown: (...args: unknown[]) => mockCheckAmendmentCooldown(...args),
  getAgentEthicsProfile: (...args: unknown[]) => mockGetAgentEthicsProfile(...args),
  getViolations: (...args: unknown[]) => mockGetViolations(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Constitution routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCheckAmendmentCooldown.mockResolvedValue({ can_propose: true });
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      amendment: { amendment_id: 'amend-1', status: 'proposed' },
      data: { amendment_id: 'amend-1', status: 'proposed' },
    });
  });

  it('supports plural amendment vote aliases', async () => {
    mockVoteOnAmendment.mockResolvedValue({
      amendment_id: 'amend-1',
      status: 'voting',
      approval_rate: 0.75,
      votes: [{
        voter_id: 'node-1',
        decision: 'approve',
        weight: 1,
        cast_at: '2026-04-15T12:00:00.000Z',
      }],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/a2a/constitution/amendments/amend-1/vote',
      payload: {
        decision: 'approve',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockVoteOnAmendment).toHaveBeenCalledWith('amend-1', 'node-1', 'approve', 1, undefined);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      amendment: {
        amendment_id: 'amend-1',
        status: 'voting',
        approval_rate: 0.75,
        votes: [{
          voter_id: 'node-1',
          decision: 'approve',
          weight: 1,
          cast_at: '2026-04-15T12:00:00.000Z',
        }],
      },
      your_vote: 'approve',
      your_weight: 1,
      approval_rate: 0.75,
      status: 'voting',
      total_votes: 1,
      data: {
        amendment_id: 'amend-1',
        status: 'voting',
        approval_rate: 0.75,
        votes: [{
          voter_id: 'node-1',
          decision: 'approve',
          weight: 1,
          cast_at: '2026-04-15T12:00:00.000Z',
        }],
      },
    });
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
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      amendment: { amendment_id: 'amend-1', status: 'ratified' },
      constitution_version: { version: 2 },
      data: {
        amendment: { amendment_id: 'amend-1', status: 'ratified' },
        new_version: { version: 2 },
      },
    });
  });

  it('exposes top-level rule, version, ethics, violations, and amendment list aliases', async () => {
    mockListRules.mockReturnValue({
      rules: [{ rule_id: 'rule-1', name: 'Rule 1', priority: 10, enabled: true }],
      total: 1,
    });
    mockGetRule.mockReturnValue({ rule_id: 'rule-1', name: 'Rule 1', enabled: true });
    mockGetConstitutionVersion.mockResolvedValue({
      version: 1,
      hash: 'abc',
      ratified_at: '2026-01-01T00:00:00.000Z',
      ratified_by: 'system',
      change_summary: 'Initial constitution',
    });
    mockGetAgentEthicsProfile.mockResolvedValue({
      agent_id: 'node-1',
      score: 98,
      violations_count: 0,
      last_evaluated_at: '2026-04-15T12:00:00.000Z',
      factors: { transparency: 99, fairness: 98, safety: 97, honesty: 98 },
    });
    mockGetViolations.mockReturnValue([{ violation_id: 'vio-1', agent_id: 'node-1' }]);
    mockProposeAmendment.mockResolvedValue({ amendment_id: 'amend-2', status: 'proposed' });
    mockListAmendments.mockResolvedValue([{ amendment_id: 'amend-2', status: 'proposed' }]);

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: '/a2a/constitution/rules' }),
      app.inject({ method: 'GET', url: '/a2a/constitution/rule/rule-1' }),
      app.inject({ method: 'GET', url: '/a2a/constitution/constitution/version' }),
      app.inject({ method: 'GET', url: '/a2a/constitution/ethics/node-1' }),
      app.inject({ method: 'GET', url: '/a2a/constitution/violations/node-1' }),
      app.inject({
        method: 'POST',
        url: '/a2a/constitution/amendment',
        payload: { content: 'Add principle' },
      }),
      app.inject({ method: 'GET', url: '/a2a/constitution/amendments' }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200, 200, 201, 200]);
    expect(JSON.parse(responses[0]!.payload)).toEqual({
      success: true,
      rules: [{ rule_id: 'rule-1', name: 'Rule 1', priority: 10, enabled: true }],
      total: 1,
      data: [{ rule_id: 'rule-1', name: 'Rule 1', priority: 10, enabled: true }],
      meta: { total: 1 },
    });
    expect(JSON.parse(responses[1]!.payload)).toEqual({
      success: true,
      rule: { rule_id: 'rule-1', name: 'Rule 1', enabled: true },
      data: { rule_id: 'rule-1', name: 'Rule 1', enabled: true },
    });
    expect(JSON.parse(responses[2]!.payload)).toEqual({
      success: true,
      constitution_version: {
        version: 1,
        hash: 'abc',
        ratified_at: '2026-01-01T00:00:00.000Z',
        ratified_by: 'system',
        change_summary: 'Initial constitution',
      },
      data: {
        version: 1,
        hash: 'abc',
        ratified_at: '2026-01-01T00:00:00.000Z',
        ratified_by: 'system',
        change_summary: 'Initial constitution',
      },
    });
    expect(JSON.parse(responses[3]!.payload)).toEqual({
      success: true,
      profile: {
        agent_id: 'node-1',
        score: 98,
        violations_count: 0,
        last_evaluated_at: '2026-04-15T12:00:00.000Z',
        factors: { transparency: 99, fairness: 98, safety: 97, honesty: 98 },
      },
      data: {
        agent_id: 'node-1',
        score: 98,
        violations_count: 0,
        last_evaluated_at: '2026-04-15T12:00:00.000Z',
        factors: { transparency: 99, fairness: 98, safety: 97, honesty: 98 },
      },
    });
    expect(JSON.parse(responses[4]!.payload)).toEqual({
      success: true,
      violations: [{ violation_id: 'vio-1', agent_id: 'node-1' }],
      total: 1,
      data: [{ violation_id: 'vio-1', agent_id: 'node-1' }],
    });
    expect(JSON.parse(responses[5]!.payload)).toEqual({
      success: true,
      amendment: { amendment_id: 'amend-2', status: 'proposed' },
      data: { amendment_id: 'amend-2', status: 'proposed' },
    });
    expect(JSON.parse(responses[6]!.payload)).toEqual({
      success: true,
      amendments: [{ amendment_id: 'amend-2', status: 'proposed' }],
      total: 1,
      data: [{ amendment_id: 'amend-2', status: 'proposed' }],
    });
  });
});

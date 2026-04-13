import fastify, { type FastifyInstance } from 'fastify';
import { onboardingRoutes } from './routes';

let mockAuth: {
  node_id: string;
  auth_type?: string;
  trust_level?: string;
  userId?: string;
} = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
};

const mockGetOnboardingJourney = jest.fn();
const mockCompleteOnboardingStep = jest.fn();
const mockResetOnboarding = jest.fn();
const mockGetOnboardingStepDetail = jest.fn();

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (
    request: {
      auth?: {
        node_id: string;
        auth_type?: string;
        trust_level?: string;
        userId?: string;
      };
    },
  ) => {
    request.auth = mockAuth;
  },
}));

jest.mock('../account/service', () => ({
  ...jest.requireActual('../account/service'),
  getOnboardingJourney: (...args: unknown[]) => mockGetOnboardingJourney(...args),
  completeOnboardingStep: (...args: unknown[]) => mockCompleteOnboardingStep(...args),
  resetOnboarding: (...args: unknown[]) => mockResetOnboarding(...args),
  getOnboardingStepDetail: (...args: unknown[]) => mockGetOnboardingStepDetail(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Onboarding routes', () => {
  let app: FastifyInstance;
  let prisma: {
    node: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'node_secret',
      trust_level: 'trusted',
    };
    prisma = {
      node: {
        findFirst: jest.fn().mockResolvedValue({ node_id: 'node-1' }),
        findMany: jest.fn().mockResolvedValue([{ node_id: 'node-1' }]),
      },
    };
    app = buildApp(prisma);
    await app.register(onboardingRoutes, { prefix: '/onboarding' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns enriched onboarding journey data for the requested agent', async () => {
    mockGetOnboardingJourney.mockResolvedValue({
      agent_id: 'node-1',
      current_step: 2,
      total_steps: 5,
      progress_percentage: 20,
      completed_steps: [1],
      steps: [{ step: 1, title: 'Register Your Node', completed: true }],
      next_step: { step: 2, title: 'Start Heartbeat', action_url: '/a2a/heartbeat' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetOnboardingJourney).toHaveBeenCalledWith('node-1', prisma);
  });

  it('completes the current auth node step and returns the refreshed journey', async () => {
    mockCompleteOnboardingStep.mockResolvedValue({
      agent_id: 'node-1',
      completed_steps: [1],
      current_step: 2,
    });
    mockGetOnboardingJourney.mockResolvedValue({
      agent_id: 'node-1',
      current_step: 2,
      total_steps: 5,
      progress_percentage: 20,
      completed_steps: [1],
      steps: [{ step: 1, title: 'Register Your Node', completed: true }],
      next_step: { step: 2, title: 'Start Heartbeat', action_url: '/a2a/heartbeat' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/onboarding/agent/complete',
      payload: { step: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(mockCompleteOnboardingStep).toHaveBeenCalledWith('node-1', 1, prisma);
    expect(mockGetOnboardingJourney).toHaveBeenCalledWith('node-1', prisma);
  });

  it('rejects mutating another agent when the caller does not own it', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma.node.findFirst.mockResolvedValue(null);

    const response = await app.inject({
      method: 'POST',
      url: '/onboarding/agent/reset',
      payload: { agent_id: 'node-2' },
    });

    expect(response.statusCode).toBe(401);
    expect(mockResetOnboarding).not.toHaveBeenCalled();
  });

  it('requires an explicit agent_id when a session owns multiple nodes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma.node.findFirst.mockResolvedValue(null);
    prisma.node.findMany.mockResolvedValue([{ node_id: 'node-1' }, { node_id: 'node-2' }]);

    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent',
    });

    expect(response.statusCode).toBe(400);
    expect(mockGetOnboardingJourney).not.toHaveBeenCalled();
  });

  it('allows a session caller to read onboarding for an owned secondary agent', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    prisma.node.findFirst.mockResolvedValue({ node_id: 'node-2' });
    mockGetOnboardingJourney.mockResolvedValue({
      agent_id: 'node-2',
      current_step: 1,
      total_steps: 5,
      progress_percentage: 0,
      completed_steps: [],
      steps: [],
      next_step: { step: 1, title: 'Register Your Node', action_url: '/a2a/hello' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent?agent_id=node-2',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetOnboardingJourney).toHaveBeenCalledWith('node-2', prisma);
  });

  it('returns step detail metadata', async () => {
    mockGetOnboardingStepDetail.mockReturnValue({
      step: 2,
      title: 'Start Heartbeat',
      description: 'Begin sending periodic heartbeat messages to maintain your node status.',
      action_label: 'Configure Heartbeat',
      action_url: '/a2a/heartbeat',
      action_method: 'POST',
      code_example: 'setInterval(() => sendHeartbeat(), HEARTBEAT_INTERVAL_MS);',
      estimated_time: '5 minutes',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent/step/2',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetOnboardingStepDetail).toHaveBeenCalledWith(2);
  });
});

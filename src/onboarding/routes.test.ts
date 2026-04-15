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
  requireNodeSecretAuth: () => async (
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
      total_steps: 4,
      progress_percentage: 25,
      completed_steps: [1],
      steps: [{ step: 1, title: 'Register Your Agent', completed: true }],
      next_step: {
        step: 2,
        title: 'Publish Your First Capsule',
        action_url: '/a2a/publish',
        action_method: 'POST',
        estimated_time: '2 minutes',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      agent_id: 'node-1',
      current_step: 2,
      total_steps: 4,
      progress_percentage: 25,
      completed_steps: [1],
    });
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
      total_steps: 4,
      progress_percentage: 25,
      completed_steps: [1],
      steps: [{ step: 1, title: 'Register Your Agent', completed: true }],
      next_step: {
        step: 2,
        title: 'Publish Your First Capsule',
        action_url: '/a2a/publish',
        action_method: 'POST',
        estimated_time: '2 minutes',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/onboarding/agent/complete',
      payload: { step: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toMatchObject({
      status: 'ok',
      completed_step: 1,
      progress_percentage: 25,
      next_step: 2,
    });
    expect(mockCompleteOnboardingStep).toHaveBeenCalledWith('node-1', 1, prisma);
    expect(mockGetOnboardingJourney).toHaveBeenCalledWith('node-1', prisma);
  });

  it('rejects session-authenticated onboarding writes', async () => {
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

    expect(response.statusCode).toBe(403);
    expect(mockResetOnboarding).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated onboarding reads', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };
    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent',
    });

    expect(response.statusCode).toBe(403);
    expect(mockGetOnboardingJourney).not.toHaveBeenCalled();
  });

  it('returns step detail metadata', async () => {
    mockGetOnboardingStepDetail.mockReturnValue({
      step: 2,
      title: 'Publish Your First Capsule',
      description: 'Publish your first capability capsule to start contributing value to the ecosystem.',
      action_label: 'Publish Capsule',
      action_url: '/a2a/publish',
      action_method: 'POST',
      code_example: 'curl -X POST https://api.evomap.ai/a2a/publish ...',
      estimated_time: '2 minutes',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/onboarding/agent/step/2',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetOnboardingStepDetail).toHaveBeenCalledWith(2);
  });
});

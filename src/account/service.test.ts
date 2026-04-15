import { PrismaClient } from '@prisma/client';
import * as service from './service';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  KeyInceptionError,
} from '../shared/errors';
import { MAX_API_KEYS_PER_USER } from '../shared/constants';

const {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  createSession,
  getOnboardingJourney,
  getOnboardingState,
  getOnboardingStepDetail,
  completeOnboardingStep,
  resetOnboarding,
} = service;

const mockPrisma = {
  apiKey: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  userSession: {
    create: jest.fn(),
  },
  onboardingState: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
} as any;

describe('Account Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    it('should create an API key with valid input', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(0);
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        prefix: 'ek_a1b2c',
        name: 'Test Key',
        scopes: ['kg'],
        expires_at: null,
        created_at: new Date('2025-01-01'),
      });

      const result = await createApiKey('user-1', 'Test Key', ['kg']);

      expect(result.id).toBe('key-1');
      expect(result.prefix).toBe('ek_a1b2c');
      expect(result.name).toBe('Test Key');
      expect(result.scopes).toEqual(['kg']);
      expect(result.key).toMatch(/^ek_[0-9a-f]{48}$/);
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
    });

    it('should create an API key with expiration date', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(0);
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-2',
        prefix: 'ek_a1b2c',
        name: 'Expiring Key',
        scopes: ['kg', 'read'],
        expires_at: new Date('2026-01-01'),
        created_at: new Date('2025-01-01'),
      });

      const result = await createApiKey(
        'user-1',
        'Expiring Key',
        ['kg', 'read'],
        '2026-01-01',
      );

      expect(result.expires_at).toBe('2026-01-01T00:00:00.000Z');
    });

    it('should throw KeyInceptionError when authType is api_key', async () => {
      await expect(
        createApiKey('user-1', 'Test', ['kg'], undefined, 'api_key'),
      ).rejects.toThrow(KeyInceptionError);
    });

    it('should throw ValidationError when name is empty', async () => {
      await expect(
        createApiKey('user-1', '', ['kg']),
      ).rejects.toThrow(ValidationError);
      await expect(
        createApiKey('user-1', '', ['kg']),
      ).rejects.toThrow('API key name is required');
    });

    it('should throw ValidationError when name is whitespace', async () => {
      await expect(
        createApiKey('user-1', '   ', ['kg']),
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when scopes is empty', async () => {
      await expect(
        createApiKey('user-1', 'Test Key', []),
      ).rejects.toThrow(ValidationError);
      await expect(
        createApiKey('user-1', 'Test Key', []),
      ).rejects.toThrow('At least one scope is required');
    });

    it('should throw ValidationError when max API keys exceeded', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(MAX_API_KEYS_PER_USER);

      await expect(
        createApiKey('user-1', 'Test Key', ['kg']),
      ).rejects.toThrow(ValidationError);
      await expect(
        createApiKey('user-1', 'Test Key', ['kg']),
      ).rejects.toThrow(`Maximum of ${MAX_API_KEYS_PER_USER} API keys per user`);
    });

    it('should allow creation when at max minus one keys', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(MAX_API_KEYS_PER_USER - 1);
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-max',
        prefix: 'ek_a1b2c',
        name: 'Last Key',
        scopes: ['kg'],
        expires_at: null,
        created_at: new Date('2025-01-01'),
      });

      const result = await createApiKey('user-1', 'Last Key', ['kg']);
      expect(result.id).toBe('key-max');
    });

    it('should reject unknown scopes', async () => {
      await expect(
        createApiKey('user-1', 'Bad Key', ['admin']),
      ).rejects.toThrow('Invalid API key scope: admin');
    });

    it('should deduplicate and trim scopes before persistence', async () => {
      mockPrisma.apiKey.count.mockResolvedValue(0);
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-clean',
        prefix: 'ek_a1b2c',
        name: 'Clean Key',
        scopes: ['kg', 'read'],
        expires_at: null,
        created_at: new Date('2025-01-01'),
      });

      await createApiKey('user-1', 'Clean Key', [' kg ', 'read', 'kg']);

      expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: ['kg', 'read'],
          }),
        }),
      );
    });
  });

  describe('listApiKeys', () => {
    it('should return list of API keys for a user', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-1',
          prefix: 'ek_a1b2c',
          name: 'Key One',
          scopes: ['kg'],
          expires_at: null,
          created_at: new Date('2025-01-01'),
        },
        {
          id: 'key-2',
          prefix: 'ek_c3d4e',
          name: 'Key Two',
          scopes: ['read'],
          expires_at: new Date('2026-01-01'),
          created_at: new Date('2025-06-01'),
        },
      ]);

      const result = await listApiKeys('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('key-1');
      expect(result[0]!.name).toBe('Key One');
      expect(result[1]!.id).toBe('key-2');
      expect(result[1]!.scopes).toEqual(['read']);
      expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 'user-1' },
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should return empty list when no keys exist', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([]);

      const result = await listApiKeys('user-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key owned by the user', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        user_id: 'user-1',
      });
      mockPrisma.apiKey.delete.mockResolvedValue({});

      await revokeApiKey('user-1', 'key-1');

      expect(mockPrisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-1' },
      });
    });

    it('should throw NotFoundError when key does not exist', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue(null);

      await expect(revokeApiKey('user-1', 'missing')).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when revoking another user key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        user_id: 'user-2',
      });

      await expect(revokeApiKey('user-1', 'key-1')).rejects.toThrow(ForbiddenError);
      await expect(revokeApiKey('user-1', 'key-1')).rejects.toThrow(
        "Cannot revoke another user's API key",
      );
    });
  });

  describe('createSession', () => {
    it('should create a session and return token with expiry', async () => {
      mockPrisma.userSession.create.mockResolvedValue({});

      const result = await createSession('user-1');

      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64);
      expect(result.expires_at).toBeDefined();
      expect(mockPrisma.userSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
          }),
        }),
      );
    });
  });

  describe('getOnboardingState', () => {
    it('should return existing onboarding state', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2],
        current_step: 3,
      });

      const result = await getOnboardingState('agent-1');

      expect(result.agent_id).toBe('agent-1');
      expect(result.completed_steps).toEqual([1, 2]);
      expect(result.current_step).toBe(3);
    });

    it('should create new onboarding state when none exists', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingState.create.mockResolvedValue({
        agent_id: 'agent-2',
        started_at: new Date('2025-01-01'),
        completed_steps: [],
        current_step: 1,
      });

      const result = await getOnboardingState('agent-2');

      expect(result.agent_id).toBe('agent-2');
      expect(result.completed_steps).toEqual([]);
      expect(result.current_step).toBe(1);
      expect(mockPrisma.onboardingState.create).toHaveBeenCalledWith({
        data: {
          agent_id: 'agent-2',
          completed_steps: [],
          current_step: 1,
        },
      });
    });
  });

  describe('getOnboardingJourney', () => {
    it('should return an enriched onboarding payload with progress metadata', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2],
        current_step: 3,
      });

      const result = await getOnboardingJourney('agent-1');

      expect(result.agent_id).toBe('agent-1');
      expect(result.total_steps).toBe(4);
      expect(result.progress_percentage).toBe(50);
      expect(result.steps).toEqual([
        { step: 1, title: 'Register Your Agent', completed: true },
        { step: 2, title: 'Publish Your First Capsule', completed: true },
        { step: 3, title: 'Enable Worker Mode', completed: false },
        { step: 4, title: 'Monitor & Earn', completed: false },
      ]);
      expect(result.next_step).toEqual({
        step: 3,
        title: 'Enable Worker Mode',
        action_url: '/api/v2/workerpool/register',
        action_method: 'POST',
        estimated_time: '1 minute',
      });
    });

    it('should ignore invalid stored steps when computing progress metadata', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2, 999],
        current_step: 999,
      });

      const result = await getOnboardingJourney('agent-1');

      expect(result.current_step).toBe(3);
      expect(result.progress_percentage).toBe(50);
      expect(result.completed_steps).toEqual([1, 2]);
      expect(result.next_step).toEqual({
        step: 3,
        title: 'Enable Worker Mode',
        action_url: '/api/v2/workerpool/register',
        action_method: 'POST',
        estimated_time: '1 minute',
      });
    });
  });

  describe('getOnboardingStepDetail', () => {
    it('should return a configured onboarding step', () => {
      const result = getOnboardingStepDetail(2);

      expect(result.step).toBe(2);
      expect(result.title).toBe('Publish Your First Capsule');
      expect(result.action_url).toBe('/a2a/publish');
    });

    it('should throw NotFoundError for an unknown step', () => {
      expect(() => getOnboardingStepDetail(99)).toThrow(NotFoundError);
    });
  });

  describe('completeOnboardingStep', () => {
    it('should complete a step and advance current_step', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1],
        current_step: 2,
      });
      mockPrisma.onboardingState.update.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2],
        current_step: 3,
      });

      const result = await completeOnboardingStep('agent-1', 2);

      expect(result.completed_steps).toEqual([1, 2]);
      expect(result.current_step).toBe(3);
    });

    it('should deduplicate completed steps', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2],
        current_step: 3,
      });
      mockPrisma.onboardingState.update.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2],
        current_step: 3,
      });

      const result = await completeOnboardingStep('agent-1', 2);

      expect(result.completed_steps).toEqual([1, 2]);
      expect(mockPrisma.onboardingState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completed_steps: [1, 2],
          }),
        }),
      );
    });

    it('should set current_step to total steps when completing last step', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2, 3],
        current_step: 4,
      });
      mockPrisma.onboardingState.update.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 2, 3, 4],
        current_step: 4,
      });

      const result = await completeOnboardingStep('agent-1', 4);

      expect(result.completed_steps).toEqual([1, 2, 3, 4]);
      expect(result.current_step).toBe(4);
    });

    it('should create onboarding state on first completion attempt', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue(null);
      mockPrisma.onboardingState.create.mockResolvedValue({
        agent_id: 'agent-x',
        started_at: new Date('2025-01-01'),
        completed_steps: [],
        current_step: 1,
      });
      mockPrisma.onboardingState.update.mockResolvedValue({
        agent_id: 'agent-x',
        started_at: new Date('2025-01-01'),
        completed_steps: [1],
        current_step: 2,
      });

      const result = await completeOnboardingStep('agent-x', 1);

      expect(result.completed_steps).toEqual([1]);
      expect(result.current_step).toBe(2);
      expect(mockPrisma.onboardingState.create).toHaveBeenCalledWith({
        data: {
          agent_id: 'agent-x',
          completed_steps: [],
          current_step: 1,
        },
      });
    });

    it('should persist current_step as the first incomplete step when completion is out of order', async () => {
      mockPrisma.onboardingState.findUnique.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1],
        current_step: 2,
      });
      mockPrisma.onboardingState.update.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [1, 3],
        current_step: 2,
      });

      const result = await completeOnboardingStep('agent-1', 3);

      expect(result.current_step).toBe(2);
      expect(mockPrisma.onboardingState.update).toHaveBeenCalledWith({
        where: { agent_id: 'agent-1' },
        data: {
          completed_steps: [1, 3],
          current_step: 2,
        },
      });
    });

    it('should reject invalid onboarding steps', async () => {
      await expect(completeOnboardingStep('agent-1', 99)).rejects.toThrow(NotFoundError);
      expect(mockPrisma.onboardingState.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('resetOnboarding', () => {
    it('should reset existing onboarding state', async () => {
      mockPrisma.onboardingState.upsert.mockResolvedValue({
        agent_id: 'agent-1',
        started_at: new Date('2025-01-01'),
        completed_steps: [],
        current_step: 1,
      });

      const result = await resetOnboarding('agent-1');

      expect(result.completed_steps).toEqual([]);
      expect(result.current_step).toBe(1);
      expect(mockPrisma.onboardingState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agent_id: 'agent-1' },
          update: { completed_steps: [], current_step: 1 },
          create: { agent_id: 'agent-1', completed_steps: [], current_step: 1 },
        }),
      );
    });

    it('should create fresh onboarding state when none exists', async () => {
      mockPrisma.onboardingState.upsert.mockResolvedValue({
        agent_id: 'agent-new',
        started_at: new Date('2025-06-01'),
        completed_steps: [],
        current_step: 1,
      });

      const result = await resetOnboarding('agent-new');

      expect(result.agent_id).toBe('agent-new');
      expect(result.completed_steps).toEqual([]);
      expect(result.current_step).toBe(1);
    });
  });
});

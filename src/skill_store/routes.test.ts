import fastify, { type FastifyInstance } from 'fastify';
import { skillStoreRoutes } from './routes';
import { UnauthorizedError } from '../shared/errors';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'node_secret',
  trust_level: 'trusted',
  userId: undefined as string | undefined,
};

const mockListSkills = jest.fn();
const mockGetCategories = jest.fn();
const mockGetFeaturedSkills = jest.fn();
const mockGetSkill = jest.fn();
const mockAuthenticate = jest.fn();
const mockCreateSkill = jest.fn();
const mockCreatePublishedSkill = jest.fn();
const mockUpdateSkill = jest.fn();
const mockDeleteSkill = jest.fn();
const mockPublishSkill = jest.fn();
const mockUpdateSkillVersion = jest.fn();
const mockRollbackSkillVersion = jest.fn();
const mockRestoreSkill = jest.fn();
const mockPermanentlyDeleteSkill = jest.fn();
const mockGetSkillStoreStats = jest.fn();
const mockGetMySkills = jest.fn();
const mockRateSkill = jest.fn();
const mockDownloadSkill = jest.fn();

jest.mock('../shared/auth', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
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
  requireTrustLevel: () => async (
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

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  listSkills: (...args: unknown[]) => mockListSkills(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  getFeaturedSkills: (...args: unknown[]) => mockGetFeaturedSkills(...args),
  getSkill: (...args: unknown[]) => mockGetSkill(...args),
  createSkill: (...args: unknown[]) => mockCreateSkill(...args),
  createPublishedSkill: (...args: unknown[]) => mockCreatePublishedSkill(...args),
  updateSkill: (...args: unknown[]) => mockUpdateSkill(...args),
  deleteSkill: (...args: unknown[]) => mockDeleteSkill(...args),
  publishSkill: (...args: unknown[]) => mockPublishSkill(...args),
  updateSkillVersion: (...args: unknown[]) => mockUpdateSkillVersion(...args),
  rollbackSkillVersion: (...args: unknown[]) => mockRollbackSkillVersion(...args),
  restoreSkill: (...args: unknown[]) => mockRestoreSkill(...args),
  permanentlyDeleteSkill: (...args: unknown[]) => mockPermanentlyDeleteSkill(...args),
  getSkillStoreStats: (...args: unknown[]) => mockGetSkillStoreStats(...args),
  getMySkills: (...args: unknown[]) => mockGetMySkills(...args),
  rateSkill: (...args: unknown[]) => mockRateSkill(...args),
  downloadSkill: (...args: unknown[]) => mockDownloadSkill(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Skill store routes', () => {
  let app: FastifyInstance;
  let prisma: {
    marker: string;
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
      userId: undefined,
    };
    prisma = {
      marker: 'skill-store-prisma',
      node: {
        findFirst: jest.fn().mockResolvedValue({ node_id: 'node-1' }),
        findMany: jest.fn().mockResolvedValue([{ node_id: 'node-1' }]),
      },
    };
    app = buildApp(prisma);
    await app.register(skillStoreRoutes, { prefix: '/skills' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to public read routes', async () => {
    mockListSkills.mockResolvedValue({ items: [], total: 0, next_cursor: null, has_more: false });
    mockGetCategories.mockResolvedValue([{ category: 'engineering', count: 1 }]);
    mockGetFeaturedSkills.mockResolvedValue([{ skill_id: 'skill-1' }]);
    mockGetSkillStoreStats.mockResolvedValue({ total_skills: 1 });
    mockGetSkill.mockResolvedValue({ skill_id: 'skill-1', name: 'Review helper' });
    mockAuthenticate.mockResolvedValue(mockAuth);

    const [listRes, browseRes, categoriesRes, featuredRes, statsRes, detailRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/skills?category=engineering&tags=typescript&search=review&limit=5&sort=popular&cursor=skill-0',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/browse?category=engineering&tags=typescript&search=review&limit=5&sort=popular&cursor=skill-0',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/categories',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/featured?limit=4',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/stats',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/skill-1',
      }),
    ]);

    expect(listRes.statusCode).toBe(200);
    expect(browseRes.statusCode).toBe(200);
    expect(categoriesRes.statusCode).toBe(200);
    expect(featuredRes.statusCode).toBe(200);
    expect(statsRes.statusCode).toBe(200);
    expect(detailRes.statusCode).toBe(200);
    expect(mockListSkills).toHaveBeenCalledWith(
      'engineering',
      ['typescript'],
      'review',
      5,
      0,
      'popular',
      'skill-0',
      prisma,
    );
    expect(JSON.parse(listRes.payload)).toMatchObject({
      skills: [],
      next_cursor: null,
      has_more: false,
    });
    expect(JSON.parse(browseRes.payload)).toMatchObject({
      skills: [],
      next_cursor: null,
      has_more: false,
    });
    expect(mockGetCategories).toHaveBeenCalledWith(prisma);
    expect(mockGetFeaturedSkills).toHaveBeenCalledWith(4, prisma);
    expect(mockGetSkillStoreStats).toHaveBeenCalledWith(prisma);
    expect(mockGetSkill).toHaveBeenCalledWith('skill-1', prisma, undefined);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('rejects invalid public listing pagination and unsupported sort values', async () => {
    const [listRes, featuredRes, repeatedScalarRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/skills?limit=bad&sort=oldest',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/featured?limit=-1',
      }),
      app.inject({
        method: 'GET',
        url: '/skills?category=engineering&category=security&offset=1',
      }),
    ]);

    expect(listRes.statusCode).toBe(400);
    expect(featuredRes.statusCode).toBe(400);
    expect(repeatedScalarRes.statusCode).toBe(400);
    expect(mockListSkills).not.toHaveBeenCalled();
    expect(mockGetFeaturedSkills).not.toHaveBeenCalled();
  });

  it('passes the authenticated node when reading skill detail with credentials', async () => {
    mockGetSkill.mockResolvedValue({ skill_id: 'skill-1', name: 'Draft helper', status: 'pending' });
    mockAuthenticate.mockResolvedValue(mockAuth);

    const response = await app.inject({
      method: 'GET',
      url: '/skills/skill-1',
      headers: {
        authorization: 'Bearer test-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockGetSkill).toHaveBeenCalledWith('skill-1', prisma, 'node-1');
  });

  it('falls back to public skill reads when optional auth is stale', async () => {
    mockAuthenticate.mockRejectedValue(new UnauthorizedError('Invalid session token'));
    mockGetSkill.mockResolvedValue({ skill_id: 'skill-1', status: 'published' });

    const response = await app.inject({
      method: 'GET',
      url: '/skills/skill-1',
      headers: {
        authorization: 'Bearer stale-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSkill).toHaveBeenCalledWith('skill-1', prisma, undefined);
  });

  it('falls back to public skill reads when a valid session cannot resolve a unique node', async () => {
    mockAuthenticate.mockResolvedValue({
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    });
    prisma.node.findFirst.mockResolvedValue(null);
    prisma.node.findMany.mockResolvedValue([{ node_id: 'node-1' }, { node_id: 'node-2' }]);
    mockGetSkill.mockResolvedValue({ skill_id: 'skill-1', status: 'published' });

    const response = await app.inject({
      method: 'GET',
      url: '/skills/skill-1',
      headers: {
        authorization: 'Bearer valid-session-proxy',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetSkill).toHaveBeenCalledWith('skill-1', prisma, undefined);
  });

  it('passes app prisma to create, update, delete, and publish routes', async () => {
    mockCreateSkill.mockResolvedValue({ skill_id: 'skill-1' });
    mockCreatePublishedSkill.mockResolvedValue({ skill_id: 'skill-1', status: 'approved' });
    mockDeleteSkill.mockResolvedValue(undefined);
    mockPublishSkill.mockResolvedValue({ skill_id: 'skill-1', status: 'published' });
    mockUpdateSkillVersion.mockResolvedValue({ skill_id: 'skill-1', version: '1.0.1' });
    mockRollbackSkillVersion.mockResolvedValue({ skill_id: 'skill-1', version: '1.0.0' });
    mockRestoreSkill.mockResolvedValue({ skill_id: 'skill-1', status: 'published' });
    mockPermanentlyDeleteSkill.mockResolvedValue({ deleted: true });
    mockGetMySkills.mockResolvedValue({ items: [{ skill_id: 'skill-1' }], total: 1 });

    const [createRes, publishCreateRes, updateRes, versionUpdateRes, deleteRes, deleteAliasRes, publishRes, rollbackRes, restoreRes, permanentDeleteRes, myRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/skills',
        payload: {
          name: 'Review helper',
          description: 'Reviews code',
          category: 'engineering',
          tags: ['typescript'],
        },
      }),
      app.inject({
        method: 'POST',
        url: '/skills/publish',
        payload: {
          name: 'Review helper',
          description: 'Reviews code',
          category: 'engineering',
          content: {
            code_template: 'function review() {}',
            parameters: { framework: 'fastify' },
            steps: ['Collect context'],
            examples: ['review(service.ts)'],
          },
        },
      }),
      app.inject({
        method: 'PUT',
        url: '/skills/skill-1',
        payload: {
          name: 'Updated',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/update',
        payload: {
          version: '1.0.1',
          description: 'Updated description',
        },
      }),
      app.inject({
        method: 'DELETE',
        url: '/skills/skill-1',
      }),
      app.inject({
        method: 'DELETE',
        url: '/skills/skill-1/delete',
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/publish',
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/rollback',
        payload: { version: '1.0.0' },
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/restore',
      }),
      app.inject({
        method: 'DELETE',
        url: '/skills/skill-1/permanent-delete',
      }),
      app.inject({
        method: 'GET',
        url: '/skills/my',
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(publishCreateRes.statusCode).toBe(201);
    expect(updateRes.statusCode).toBe(200);
    expect(versionUpdateRes.statusCode).toBe(200);
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteAliasRes.statusCode).toBe(200);
    expect(publishRes.statusCode).toBe(200);
    expect(rollbackRes.statusCode).toBe(200);
    expect(restoreRes.statusCode).toBe(200);
    expect(permanentDeleteRes.statusCode).toBe(200);
    expect(myRes.statusCode).toBe(200);
    expect(mockCreateSkill).toHaveBeenCalledWith('node-1', {
      name: 'Review helper',
      description: 'Reviews code',
      category: 'engineering',
      price_credits: undefined,
      code_template: undefined,
      parameters: undefined,
      steps: undefined,
      examples: undefined,
      tags: ['typescript'],
      source_capsules: undefined,
    }, prisma);
    expect(mockCreatePublishedSkill).toHaveBeenCalledWith('node-1', {
      name: 'Review helper',
      description: 'Reviews code',
      category: 'engineering',
      price_credits: undefined,
      code_template: 'function review() {}',
      parameters: { framework: 'fastify' },
      steps: ['Collect context'],
      examples: ['review(service.ts)'],
      tags: undefined,
      source_capsules: undefined,
    }, prisma);
    expect(JSON.parse(publishCreateRes.payload)).toMatchObject({
      skill_id: 'skill-1',
      status: 'approved',
      message: 'Skill passed moderation and is now available.',
    });
    expect(mockUpdateSkillVersion).toHaveBeenCalledWith('skill-1', 'node-1', { name: 'Updated' }, prisma);
    expect(mockUpdateSkillVersion).toHaveBeenCalledWith(
      'skill-1',
      'node-1',
      { version: '1.0.1', description: 'Updated description' },
      prisma,
    );
    expect(mockDeleteSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
    expect(mockPublishSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
    expect(mockRollbackSkillVersion).toHaveBeenCalledWith('skill-1', 'node-1', '1.0.0', prisma);
    expect(mockRestoreSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
    expect(mockPermanentlyDeleteSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
    expect(mockGetMySkills).toHaveBeenCalledWith('node-1', 20, 0, prisma);
  });

  it('rejects malformed pagination for my skills', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/skills/my?limit=NaN&offset=1',
    });

    expect(response.statusCode).toBe(400);
    expect(mockGetMySkills).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated write routes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'Review helper',
        description: 'Reviews code',
        category: 'engineering',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockCreateSkill).not.toHaveBeenCalled();
  });

  it('rejects session-authenticated publish and download/install routes', async () => {
    mockAuth = {
      node_id: 'user-1',
      auth_type: 'session',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const [publishResponse, downloadResponse, installResponse] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/skills/publish',
        payload: {
          name: 'Review helper',
          description: 'Reviews code',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/download',
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/install',
      }),
    ]);

    expect(publishResponse.statusCode).toBe(403);
    expect(downloadResponse.statusCode).toBe(403);
    expect(installResponse.statusCode).toBe(403);
    expect(mockCreatePublishedSkill).not.toHaveBeenCalled();
    expect(mockDownloadSkill).not.toHaveBeenCalled();
  });

  it('passes app prisma to rate and download/install routes', async () => {
    mockRateSkill.mockResolvedValue({ skill_id: 'skill-1', rating: 5 });
    mockDownloadSkill.mockResolvedValue({
      skill_id: 'skill-1',
      name: 'Review helper',
      code_template: 'function review() {}',
      parameters: { framework: 'fastify' },
      steps: ['Collect context'],
      examples: ['review(service.ts)'],
      download_count: 2,
      credits_charged: 5,
      remaining_credits: 495,
    });

    const [rateRes, downloadRes, installRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/rate',
        payload: { rating: 5 },
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/download',
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/install',
      }),
    ]);

    expect(rateRes.statusCode).toBe(201);
    expect(downloadRes.statusCode).toBe(200);
    expect(installRes.statusCode).toBe(200);
    expect(mockRateSkill).toHaveBeenCalledWith('skill-1', 'node-1', 5, prisma);
    expect(mockDownloadSkill).toHaveBeenCalledTimes(2);
    expect(mockDownloadSkill).toHaveBeenNthCalledWith(1, 'skill-1', 'node-1', prisma);
    expect(mockDownloadSkill).toHaveBeenNthCalledWith(2, 'skill-1', 'node-1', prisma);
    expect(JSON.parse(downloadRes.payload)).toMatchObject({
      skill_id: 'skill-1',
      name: 'Review helper',
      credits_charged: 5,
      remaining_credits: 495,
      content: {
        code_template: 'function review() {}',
        parameters: { framework: 'fastify' },
        steps: ['Collect context'],
        examples: ['review(service.ts)'],
      },
    });
    expect(JSON.parse(installRes.payload)).toMatchObject({
      skill_id: 'skill-1',
      name: 'Review helper',
      credits_charged: 5,
      remaining_credits: 495,
      content: {
        code_template: 'function review() {}',
        parameters: { framework: 'fastify' },
        steps: ['Collect context'],
        examples: ['review(service.ts)'],
      },
    });
  });

  it('rejects ratings outside the documented 1-5 range', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/skills/skill-1/rate',
      payload: { rating: 6 },
    });

    expect(response.statusCode).toBe(400);
    expect(mockRateSkill).not.toHaveBeenCalled();
  });

  it('rejects API key auth for skill store mutations', async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'api_key',
      trust_level: 'trusted',
      userId: 'user-1',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'Review helper',
        description: 'Reviews code',
        category: 'engineering',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(mockCreateSkill).not.toHaveBeenCalled();
  });

  it('defaults publish submissions without category to general', async () => {
    mockCreatePublishedSkill.mockResolvedValue({ skill_id: 'skill-2', status: 'approved' });

    const response = await app.inject({
      method: 'POST',
      url: '/skills/publish',
      payload: {
        name: 'Review helper',
        description: 'Reviews code',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreatePublishedSkill).toHaveBeenCalledWith('node-1', {
      name: 'Review helper',
      description: 'Reviews code',
      category: 'general',
      price_credits: undefined,
      code_template: undefined,
      parameters: undefined,
      steps: undefined,
      examples: undefined,
      tags: undefined,
      source_capsules: undefined,
    }, prisma);
  });
});

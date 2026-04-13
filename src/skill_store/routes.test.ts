import fastify, { type FastifyInstance } from 'fastify';
import { skillStoreRoutes } from './routes';

let mockAuth = {
  node_id: 'node-1',
  auth_type: 'session',
  trust_level: 'trusted',
};

const mockListSkills = jest.fn();
const mockGetCategories = jest.fn();
const mockGetFeaturedSkills = jest.fn();
const mockGetSkill = jest.fn();
const mockCreateSkill = jest.fn();
const mockUpdateSkill = jest.fn();
const mockDeleteSkill = jest.fn();
const mockPublishSkill = jest.fn();
const mockRateSkill = jest.fn();
const mockDownloadSkill = jest.fn();

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
  listSkills: (...args: unknown[]) => mockListSkills(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  getFeaturedSkills: (...args: unknown[]) => mockGetFeaturedSkills(...args),
  getSkill: (...args: unknown[]) => mockGetSkill(...args),
  createSkill: (...args: unknown[]) => mockCreateSkill(...args),
  updateSkill: (...args: unknown[]) => mockUpdateSkill(...args),
  deleteSkill: (...args: unknown[]) => mockDeleteSkill(...args),
  publishSkill: (...args: unknown[]) => mockPublishSkill(...args),
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
  let prisma: { marker: string };

  beforeEach(async () => {
    mockAuth = {
      node_id: 'node-1',
      auth_type: 'session',
      trust_level: 'trusted',
    };
    prisma = { marker: 'skill-store-prisma' };
    app = buildApp(prisma);
    await app.register(skillStoreRoutes, { prefix: '/skills' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes app prisma to public read routes', async () => {
    mockListSkills.mockResolvedValue({ items: [], total: 0 });
    mockGetCategories.mockResolvedValue([{ category: 'engineering', count: 1 }]);
    mockGetFeaturedSkills.mockResolvedValue([{ skill_id: 'skill-1' }]);
    mockGetSkill.mockResolvedValue({ skill_id: 'skill-1', name: 'Review helper' });

    const [listRes, categoriesRes, featuredRes, detailRes] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/skills?category=engineering&tags=typescript&search=review&limit=5&offset=2&sort=rating',
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
        url: '/skills/skill-1',
      }),
    ]);

    expect(listRes.statusCode).toBe(200);
    expect(categoriesRes.statusCode).toBe(200);
    expect(featuredRes.statusCode).toBe(200);
    expect(detailRes.statusCode).toBe(200);
    expect(mockListSkills).toHaveBeenCalledWith('engineering', ['typescript'], 'review', 5, 2, 'rating', prisma);
    expect(mockGetCategories).toHaveBeenCalledWith(prisma);
    expect(mockGetFeaturedSkills).toHaveBeenCalledWith(4, prisma);
    expect(mockGetSkill).toHaveBeenCalledWith('skill-1', prisma);
  });

  it('passes app prisma to create, update, delete, and publish routes', async () => {
    mockCreateSkill.mockResolvedValue({ skill_id: 'skill-1' });
    mockUpdateSkill.mockResolvedValue({ skill_id: 'skill-1', name: 'Updated' });
    mockDeleteSkill.mockResolvedValue(undefined);
    mockPublishSkill.mockResolvedValue({ skill_id: 'skill-1', status: 'published' });

    const [createRes, updateRes, deleteRes, publishRes] = await Promise.all([
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
        method: 'PUT',
        url: '/skills/skill-1',
        payload: {
          name: 'Updated',
        },
      }),
      app.inject({
        method: 'DELETE',
        url: '/skills/skill-1',
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/publish',
      }),
    ]);

    expect(createRes.statusCode).toBe(201);
    expect(updateRes.statusCode).toBe(200);
    expect(deleteRes.statusCode).toBe(200);
    expect(publishRes.statusCode).toBe(200);
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
    expect(mockUpdateSkill).toHaveBeenCalledWith('skill-1', 'node-1', { name: 'Updated' }, prisma);
    expect(mockDeleteSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
    expect(mockPublishSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
  });

  it('passes app prisma to rate and download routes', async () => {
    mockRateSkill.mockResolvedValue({ skill_id: 'skill-1', rating: 5 });
    mockDownloadSkill.mockResolvedValue({ skill_id: 'skill-1', download_count: 2 });

    const [rateRes, downloadRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/rate',
        payload: { rating: 5 },
      }),
      app.inject({
        method: 'POST',
        url: '/skills/skill-1/download',
      }),
    ]);

    expect(rateRes.statusCode).toBe(201);
    expect(downloadRes.statusCode).toBe(200);
    expect(mockRateSkill).toHaveBeenCalledWith('skill-1', 'node-1', 5, prisma);
    expect(mockDownloadSkill).toHaveBeenCalledWith('skill-1', 'node-1', prisma);
  });
});

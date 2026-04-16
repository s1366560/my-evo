import fastify, { type FastifyInstance } from 'fastify';
import { recipeRoutes } from './routes';
import { organismRoutes } from './organism-routes';

const mockListRecipes = jest.fn();
const mockCreateRecipe = jest.fn();
const mockGetOrganism = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  listRecipes: (...args: unknown[]) => mockListRecipes(...args),
  createRecipe: (...args: unknown[]) => mockCreateRecipe(...args),
  getOrganism: (...args: unknown[]) => mockGetOrganism(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-1' };
  },
}));

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', {
    recipe: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    organism: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  } as any);
  return app;
}

describe('Recipe compatibility routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(recipeRoutes, { prefix: '/api/v2/recipe' });
    await app.register(organismRoutes, { prefix: '/api/v2/organism' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports the documented singular recipe list endpoint', async () => {
    mockListRecipes.mockResolvedValue({
      items: [{ recipe_id: 'recipe-1' }],
      total: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/recipe/list?status=published&author=node-2&limit=5&offset=1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockListRecipes).toHaveBeenCalledWith('published', 'node-2', 5, 1);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      recipes: [{ recipe_id: 'recipe-1' }],
      total: 1,
      data: {
        items: [{ recipe_id: 'recipe-1' }],
        total: 1,
      },
    });
  });

  it('supports the documented singular recipe create endpoint', async () => {
    mockCreateRecipe.mockResolvedValue({ recipe_id: 'recipe-2' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/recipe/create',
      payload: {
        title: 'New recipe',
        description: 'Create from alias',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateRecipe).toHaveBeenCalledWith(
      'node-1',
      'New recipe',
      'Create from alias',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      recipe: { recipe_id: 'recipe-2' },
      data: { recipe_id: 'recipe-2' },
    });
  });

  it('supports the documented organism detail endpoint', async () => {
    mockGetOrganism.mockResolvedValue({
      organism_id: 'org-1',
      recipe_id: 'recipe-1',
      status: 'running',
      genes_expressed: 1,
      genes_total_count: 4,
      current_position: 2,
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/organism/org-1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetOrganism).toHaveBeenCalledWith('org-1');
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      organism: {
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'running',
        genes_expressed: 1,
        genes_total_count: 4,
        current_position: 2,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      data: {
        organism_id: 'org-1',
        recipe_id: 'recipe-1',
        status: 'running',
        genes_expressed: 1,
        genes_total_count: 4,
        current_position: 2,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('returns organism execution progress from the documented progress endpoint', async () => {
    mockGetOrganism.mockResolvedValue({
      organism_id: 'org-9',
      recipe_id: 'recipe-3',
      status: 'running',
      genes_expressed: 3,
      genes_total_count: 4,
      current_position: 3,
      updated_at: new Date('2026-01-01T00:00:00Z'),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/organism/org-9/progress',
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({
      success: true,
      organism_id: 'org-9',
      recipe_id: 'recipe-3',
      status: 'running',
      genes_expressed: 3,
      genes_total_count: 4,
      current_position: 3,
      progress_percent: 75,
      updated_at: '2026-01-01T00:00:00.000Z',
      data: {
        organism_id: 'org-9',
        recipe_id: 'recipe-3',
        status: 'running',
        genes_expressed: 3,
        genes_total_count: 4,
        current_position: 3,
        progress_percent: 75,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    });
  });
});

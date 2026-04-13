import fastify, { type FastifyInstance } from 'fastify';
import { searchRoutes } from './routes';

const mockSearch = jest.fn();
const mockAutocomplete = jest.fn();
const mockTrending = jest.fn();
const mockFindSimilar = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  search: (...args: unknown[]) => mockSearch(...args),
  autocomplete: (...args: unknown[]) => mockAutocomplete(...args),
  trending: (...args: unknown[]) => mockTrending(...args),
  findSimilar: (...args: unknown[]) => mockFindSimilar(...args),
}));

function buildApp(prisma: unknown): FastifyInstance {
  const app = fastify({ logger: false });
  app.decorate('prisma', prisma as any);
  return app;
}

describe('Search routes', () => {
  let app: FastifyInstance;
  let prisma: { marker: string };

  beforeEach(async () => {
    prisma = { marker: 'search-prisma' };
    app = buildApp(prisma);
    await app.register(searchRoutes, { prefix: '/search' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects non-public status filters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/search?q=test&status=draft',
    });

    expect(response.statusCode).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('passes promoted status through to the search service', async () => {
    mockSearch.mockResolvedValue({
      items: [],
      total: 0,
      facets: { by_type: {}, by_signal: {} },
      query_time_ms: 1,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/search?q=test&status=promoted',
    });

    expect(response.statusCode).toBe(200);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'test',
        status: 'promoted',
      }),
      prisma,
    );
  });

  it('passes app prisma to autocomplete', async () => {
    mockAutocomplete.mockResolvedValue({ suggestions: [{ text: 'test', type: 'name', score: 1 }] });

    const response = await app.inject({
      method: 'GET',
      url: '/search/autocomplete?prefix=test&type=gene',
    });

    expect(response.statusCode).toBe(200);
    expect(mockAutocomplete).toHaveBeenCalledWith('test', 'gene', prisma);
  });

  it('passes app prisma to trending', async () => {
    mockTrending.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/search/trending?limit=5',
    });

    expect(response.statusCode).toBe(200);
    expect(mockTrending).toHaveBeenCalledWith(5, prisma);
  });

  it('passes app prisma to similar search', async () => {
    mockFindSimilar.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: '/search/similar/asset-1?threshold=0.9',
    });

    expect(response.statusCode).toBe(200);
    expect(mockFindSimilar).toHaveBeenCalledWith('asset-1', 0.9, prisma);
  });
});

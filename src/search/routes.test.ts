import fastify, { type FastifyInstance } from 'fastify';
import { searchRoutes } from './routes';

const mockSearch = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  search: (...args: unknown[]) => mockSearch(...args),
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Search routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
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
    );
  });
});

import type { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import { readingRoutes } from './routes';

const mockReadUrl = jest.fn();
const mockGetTrendingReadings = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  readUrl: (...args: unknown[]) => mockReadUrl(...args),
  getTrendingReadings: (...args: unknown[]) => mockGetTrendingReadings(...args),
}));

jest.mock('../shared/auth', () => ({
  requireAuth: () => async (request: { auth?: { node_id: string } }) => {
    request.auth = { node_id: 'node-reading-test' };
  },
}));

function buildApp(): FastifyInstance {
  return fastify({ logger: false });
}

describe('Reading routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp();
    await app.register(readingRoutes, { prefix: '/api/v2/reading' });
    await app.ready();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should analyze a URL', async () => {
    mockReadUrl.mockResolvedValue({
      id: 'reading-1',
      url: 'https://example.com/article',
      title: 'example.com',
      content: 'Example content',
      summary: 'Example summary',
      keyInformation: ['Source host: example.com'],
      questions: [],
      entities: [],
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/reading/analyze',
      headers: { authorization: 'Bearer test' },
      payload: { url: 'https://example.com/article' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockReadUrl).toHaveBeenCalledWith('https://example.com/article', 'node-reading-test');
  });

  it('should return trending readings with a parsed limit', async () => {
    mockGetTrendingReadings.mockReturnValue([
      {
        id: 'reading-1',
        url: 'https://example.com/article',
        title: 'example.com',
        summary: 'Example summary',
        analyzed_at: '2026-01-01T00:00:00.000Z',
        hostname: 'example.com',
        hits: 2,
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/reading/trending?limit=1',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetTrendingReadings).toHaveBeenCalledWith('node-reading-test', 1);
  });
});

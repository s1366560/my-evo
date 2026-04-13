import type { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import { readingRoutes } from './routes';

const mockReadUrl = jest.fn();
const mockIngestReading = jest.fn();
const mockGetCommunityTrendingReadings = jest.fn();
const mockGetReadingHistory = jest.fn();
const mockGetReadingDetail = jest.fn();
const mockListMyQuestions = jest.fn();
const mockCreateQuestionBounty = jest.fn();
const mockDismissQuestion = jest.fn();

jest.mock('./service', () => ({
  ...jest.requireActual('./service'),
  readUrl: (...args: unknown[]) => mockReadUrl(...args),
  ingestReading: (...args: unknown[]) => mockIngestReading(...args),
  getCommunityTrendingReadings: (...args: unknown[]) => mockGetCommunityTrendingReadings(...args),
  getReadingHistory: (...args: unknown[]) => mockGetReadingHistory(...args),
  getReadingDetail: (...args: unknown[]) => mockGetReadingDetail(...args),
  listMyQuestions: (...args: unknown[]) => mockListMyQuestions(...args),
  createQuestionBounty: (...args: unknown[]) => mockCreateQuestionBounty(...args),
  dismissQuestion: (...args: unknown[]) => mockDismissQuestion(...args),
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

  it('should ingest raw text through the reading service alias', async () => {
    mockIngestReading.mockResolvedValue({
      reading: {
        id: 'reading-text-1',
        url: 'https://reading.evomap.invalid/text/abc',
        title: 'Custom text title',
        content: 'A long text input for analysis',
        summary: 'Example summary',
        keyInformation: ['Source host: text'],
        questions: [],
        entities: [],
      },
      source_type: 'text',
      deduplicated: false,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/reading/ingest',
      headers: { authorization: 'Bearer test' },
      payload: {
        text: 'This is a sufficiently long text input for the Reading Engine to analyze in text mode.',
        title: 'Custom text title',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(mockIngestReading).toHaveBeenCalledWith(
      {
        text: 'This is a sufficiently long text input for the Reading Engine to analyze in text mode.',
        title: 'Custom text title',
      },
      'node-reading-test',
    );
  });

  it('should return community trending readings with a parsed limit', async () => {
    mockGetCommunityTrendingReadings.mockReturnValue([
      {
        id: 'reading-1',
        url: 'https://example.com/article',
        title: 'example.com',
        summary: 'Example summary',
        analyzed_at: '2026-01-01T00:00:00.000Z',
        hostname: 'example.com',
        hits: 2,
        source_type: 'url',
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/reading/trending?limit=1',
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetCommunityTrendingReadings).toHaveBeenCalledWith(1);
  });

  it('should return reading history for the authenticated user', async () => {
    mockGetReadingHistory.mockReturnValue({
      items: [],
      total: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/reading/history?limit=5&offset=2&sort_by=oldest&source_type=text',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetReadingHistory).toHaveBeenCalledWith('node-reading-test', 5, 2, {
      sort_by: 'oldest',
      source_type: 'text',
    });
  });

  it('should return reading detail for the authenticated user', async () => {
    mockGetReadingDetail.mockReturnValue({
      reading: {
        id: 'reading-1',
        url: 'https://example.com/article',
        title: 'example.com',
        content: 'Example content',
        summary: 'Example summary',
        keyInformation: ['Source host: example.com'],
        questions: [],
        entities: [],
      },
      source_type: 'url',
      analyzed_at: '2026-01-01T00:00:00.000Z',
      deduplicated: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/reading/reading-1',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockGetReadingDetail).toHaveBeenCalledWith('reading-1', 'node-reading-test');
  });

  it('should list the current user\'s discovered questions with pagination filters', async () => {
    mockListMyQuestions.mockReturnValue({
      items: [],
      total: 0,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v2/reading/my-questions?status=pending&limit=5&offset=2',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockListMyQuestions).toHaveBeenCalledWith('node-reading-test', {
      status: 'pending',
      limit: 5,
      offset: 2,
    });
  });

  it('should create a bounty for a discovered reading question', async () => {
    mockCreateQuestionBounty.mockResolvedValue({
      bounty_id: 'bounty-1',
      amount: 25,
      question: {
        question_id: 'rq-1',
        reading_id: 'reading-1',
        reading_title: 'Example',
        reading_url: 'https://example.com/article',
        text: 'What does the article leave unresolved?',
        type: 'analytical',
        difficulty: 'medium',
        discovered_at: '2026-01-01T00:00:00.000Z',
        status: 'bountied',
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/reading/questions/rq-1/bounty',
      headers: { authorization: 'Bearer test' },
      payload: {
        amount: 25,
        deadline: '2026-12-31T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateQuestionBounty).toHaveBeenCalledWith(
      'node-reading-test',
      'node-reading-test',
      'rq-1',
      {
        amount: 25,
        deadline: '2026-12-31T00:00:00.000Z',
      },
    );
  });

  it('should dismiss a discovered reading question', async () => {
    mockDismissQuestion.mockReturnValue({
      question_id: 'rq-1',
      reading_id: 'reading-1',
      reading_title: 'Example',
      reading_url: 'https://example.com/article',
      text: 'What does the article leave unresolved?',
      type: 'analytical',
      difficulty: 'medium',
      discovered_at: '2026-01-01T00:00:00.000Z',
      status: 'dismissed',
      dismissed_at: '2026-01-02T00:00:00.000Z',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v2/reading/questions/rq-1/dismiss',
      headers: { authorization: 'Bearer test' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDismissQuestion).toHaveBeenCalledWith('node-reading-test', 'rq-1');
  });
});

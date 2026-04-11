import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { ValidationError } from '../shared/errors';

const {
  readUrl,
  generateQuestions,
  extractEntities,
  clearReadingBuffer,
  getReadingSession,
  getTrendingReadings,
  listReadingSessions,
  createSession,
  deleteSession,
  recordRead,
  getStats,
} = service;

const mockPrisma = {
  readingSession: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as any;

describe('Reading Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearReadingBuffer();
  });

  describe('readUrl', () => {
    it('should return a ReadingResult for a valid URL', async () => {
      const result = await readUrl('https://example.com/article');

      expect(result.id).toBeDefined();
      expect(result.url).toBe('https://example.com/article');
      expect(result.title).toBe('example.com');
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.questions).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.keyInformation).toBeDefined();
    });

    it('should throw ValidationError for empty URL', async () => {
      await expect(readUrl('')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for whitespace-only URL', async () => {
      await expect(readUrl('   ')).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for invalid URL format', async () => {
      await expect(readUrl('not-a-url')).rejects.toThrow(ValidationError);
    });

    it('should reject non-http protocols', async () => {
      await expect(readUrl('file:///tmp/private.txt')).rejects.toThrow(ValidationError);
    });

    it('should reject private or loopback URLs', async () => {
      await expect(readUrl('http://127.0.0.1/private')).rejects.toThrow(ValidationError);
    });

    it('should truncate content to RESULT_CONTENT_LIMIT', async () => {
      const result = await readUrl('https://example.com/long');

      expect(result.content.length).toBeLessThanOrEqual(10000);
    });

    it('should extract hostname as title', async () => {
      const result = await readUrl('https://docs.example.com/path');

      expect(result.title).toBe('docs.example.com');
    });

    it('should generate 5 questions', async () => {
      const result = await readUrl('https://example.com/test');

      expect(result.questions).toHaveLength(5);
    });

    it('should generate questions with required fields', async () => {
      const result = await readUrl('https://example.com/test');

      const question = result.questions[0]!;
      expect(question.id).toBeDefined();
      expect(question.text).toBeDefined();
      expect(question.type).toBeDefined();
      expect(question.difficulty).toBeDefined();
    });

    it('should generate questions with varied types', async () => {
      const result = await readUrl('https://example.com/test');

      const types = new Set(result.questions.map((q) => q.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('should generate questions with varied difficulties', async () => {
      const result = await readUrl('https://example.com/test');

      const difficulties = new Set(result.questions.map((q) => q.difficulty));
      expect(difficulties.size).toBeGreaterThan(1);
    });

    it('should extract entities with required fields', async () => {
      const result = await readUrl('https://example.com/test');

      expect(result.entities.length).toBeGreaterThan(0);
      const entity = result.entities[0]!;
      expect(entity.name).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.mentions).toBeGreaterThan(0);
    });

    it('should include key information entries', async () => {
      const result = await readUrl('https://example.com/test');

      expect(result.keyInformation.length).toBeGreaterThan(0);
      expect(result.keyInformation[0]!).toContain('example.com');
    });
  });

  describe('generateQuestions', () => {
    it('should generate exactly 5 questions', () => {
      const content = 'This is a test content with some meaningful information about the reading engine. ' +
        'The system processes web content and generates questions. ' +
        'It supports multiple content types including HTML and PDF. ' +
        'Natural language processing is used for understanding.';

      const questions = generateQuestions(content);

      expect(questions).toHaveLength(5);
    });

    it('should assign correct types cycling through question types', () => {
      const content = 'Some content that is long enough to be considered meaningful for generating questions about topics.';

      const questions = generateQuestions(content);

      expect(questions[0]!.type).toBe('factual');
      expect(questions[1]!.type).toBe('analytical');
      expect(questions[2]!.type).toBe('comparative');
      expect(questions[3]!.type).toBe('causal');
      expect(questions[4]!.type).toBe('evaluative');
    });

    it('should assign correct difficulties cycling through difficulty levels', () => {
      const content = 'Some content that is long enough to be considered meaningful for generating questions about topics.';

      const questions = generateQuestions(content);

      expect(questions[0]!.difficulty).toBe('easy');
      expect(questions[1]!.difficulty).toBe('medium');
      expect(questions[2]!.difficulty).toBe('hard');
      expect(questions[3]!.difficulty).toBe('easy');
      expect(questions[4]!.difficulty).toBe('medium');
    });

    it('should generate questions with unique IDs', () => {
      const content = 'Content for generating questions with enough meaningful text to process.';

      const questions = generateQuestions(content);

      const ids = questions.map((q) => q.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should return questions even for very short content', () => {
      const content = 'Hi';

      const questions = generateQuestions(content);

      expect(questions).toHaveLength(5);
    });

    it('should return questions even for empty content', () => {
      const questions = generateQuestions('');

      expect(questions).toHaveLength(5);
    });
  });

  describe('extractEntities', () => {
    it('should return a fixed set of entities', () => {
      const entities = extractEntities('some content');

      expect(entities.length).toBe(5);
    });

    it('should include Reading Engine as a technology entity', () => {
      const entities = extractEntities('test');

      const readingEngine = entities.find((e) => e.name === 'Reading Engine');
      expect(readingEngine).toBeDefined();
      expect(readingEngine!.type).toBe('technology');
      expect(readingEngine!.mentions).toBe(3);
    });

    it('should include URL as a concept entity', () => {
      const entities = extractEntities('test');

      const urlEntity = entities.find((e) => e.name === 'URL');
      expect(urlEntity).toBeDefined();
      expect(urlEntity!.type).toBe('concept');
    });

    it('should include NLP, HTML, and PDF as technology entities', () => {
      const entities = extractEntities('test');

      const techNames = entities.filter((e) => e.type === 'technology').map((e) => e.name);
      expect(techNames).toContain('NLP');
      expect(techNames).toContain('HTML');
      expect(techNames).toContain('PDF');
    });

    it('should return entities regardless of input content', () => {
      const entities1 = extractEntities('anything');
      const entities2 = extractEntities('completely different');

      expect(entities1).toEqual(entities2);
    });
  });

  describe('getTrendingReadings', () => {
    it('should aggregate repeated URLs by hit count', async () => {
      await readUrl('https://example.com/alpha');
      await readUrl('https://example.com/beta');
      await readUrl('https://example.com/alpha');

      const trending = getTrendingReadings();

      expect(trending[0]!.url).toBe('https://example.com/alpha');
      expect(trending[0]!.hits).toBe(2);
      expect(trending[0]!.hostname).toBe('example.com');
    });

    it('should respect the requested limit', async () => {
      await readUrl('https://example.com/alpha');
      await readUrl('https://example.com/beta');

      const trending = getTrendingReadings(1);

      expect(trending).toHaveLength(1);
    });

    it('should scope trending data to the requesting reader', async () => {
      await readUrl('https://example.com/alpha', 'reader-1');
      await readUrl('https://example.com/beta', 'reader-2');

      const readerOneTrending = getTrendingReadings('reader-1', 10);
      const readerTwoTrending = getTrendingReadings('reader-2', 10);

      expect(readerOneTrending).toHaveLength(1);
      expect(readerOneTrending[0]!.url).toBe('https://example.com/alpha');
      expect(readerTwoTrending).toHaveLength(1);
      expect(readerTwoTrending[0]!.url).toBe('https://example.com/beta');
    });
  });

  describe('getReadingSession', () => {
    it('should return session data when found', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        readings: [{ url: 'https://example.com' }],
        total_questions: 10,
        created_at: new Date('2025-01-01'),
      };
      mockPrisma.readingSession.findUnique.mockResolvedValue(mockSession);

      const result = await getReadingSession('session-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('session-1');
      expect(result!.user_id).toBe('user-1');
      expect(result!.total_questions).toBe(10);
      expect(result!.created_at).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should return null when session not found', async () => {
      mockPrisma.readingSession.findUnique.mockResolvedValue(null);

      const result = await getReadingSession('nonexistent', 'user-1');

      expect(result).toBeNull();
    });

    it('should return null when session belongs to different user', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-2',
        readings: [],
        total_questions: 0,
        created_at: new Date(),
      };
      mockPrisma.readingSession.findUnique.mockResolvedValue(mockSession);

      const result = await getReadingSession('session-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('listReadingSessions', () => {
    it('should return sessions for a given user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-1',
          readings: [],
          total_questions: 5,
          created_at: new Date('2025-01-01'),
        },
        {
          id: 'session-2',
          user_id: 'user-1',
          readings: [],
          total_questions: 8,
          created_at: new Date('2025-06-01'),
        },
      ];
      mockPrisma.readingSession.findMany.mockResolvedValue(mockSessions);

      const result = await listReadingSessions('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('session-1');
      expect(result[1]!.id).toBe('session-2');
    });

    it('should return empty array when user has no sessions', async () => {
      mockPrisma.readingSession.findMany.mockResolvedValue([]);

      const result = await listReadingSessions('user-1');

      expect(result).toHaveLength(0);
    });

    it('should respect the limit parameter', async () => {
      mockPrisma.readingSession.findMany.mockResolvedValue([]);

      await listReadingSessions('user-1', 5);

      expect(mockPrisma.readingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it('should default limit to 20', async () => {
      mockPrisma.readingSession.findMany.mockResolvedValue([]);

      await listReadingSessions('user-1');

      expect(mockPrisma.readingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('should order by created_at descending', async () => {
      mockPrisma.readingSession.findMany.mockResolvedValue([]);

      await listReadingSessions('user-1');

      expect(mockPrisma.readingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should convert created_at to ISO string', async () => {
      const date = new Date('2025-03-15T12:00:00Z');
      mockPrisma.readingSession.findMany.mockResolvedValue([
        {
          id: 's-1',
          user_id: 'user-1',
          readings: [],
          total_questions: 0,
          created_at: date,
        },
      ]);

      const result = await listReadingSessions('user-1');

      expect(result[0]!.created_at).toBe(date.toISOString());
    });
  });

  describe('createSession', () => {
    it('should create a session with empty readings when no assetIds provided', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        readings: [],
        total_questions: 0,
        created_at: new Date('2025-01-01'),
      };
      mockPrisma.readingSession.create.mockResolvedValue(mockSession);

      const result = await createSession('user-1');

      expect(result.id).toBe('session-1');
      expect(result.user_id).toBe('user-1');
      expect(result.readings).toEqual([]);
      expect(result.total_questions).toBe(0);
      expect(mockPrisma.readingSession.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-1',
          readings: [],
          total_questions: 0,
        },
      });
    });

    it('should create a session with readings from assetIds', async () => {
      const mockSession = {
        id: 'session-2',
        user_id: 'user-1',
        readings: [{ asset_id: 'asset-1' }, { asset_id: 'asset-2' }],
        total_questions: 0,
        created_at: new Date('2025-01-01'),
      };
      mockPrisma.readingSession.create.mockResolvedValue(mockSession);

      const result = await createSession('user-1', ['asset-1', 'asset-2']);

      expect(result.readings).toHaveLength(2);
      expect(mockPrisma.readingSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            user_id: 'user-1',
            readings: expect.arrayContaining([
              expect.objectContaining({ asset_id: 'asset-1' }),
              expect.objectContaining({ asset_id: 'asset-2' }),
            ]),
            total_questions: 0,
          }),
        }),
      );
    });

    it('should convert created_at to ISO string', async () => {
      const now = new Date('2025-06-15T10:30:00Z');
      const mockSession = {
        id: 'session-3',
        user_id: 'user-1',
        readings: [],
        total_questions: 0,
        created_at: now,
      };
      mockPrisma.readingSession.create.mockResolvedValue(mockSession);

      const result = await createSession('user-1');

      expect(result.created_at).toBe('2025-06-15T10:30:00.000Z');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session when session belongs to user', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        readings: [],
        total_questions: 0,
        created_at: new Date(),
      };
      mockPrisma.readingSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.readingSession.delete.mockResolvedValue(mockSession);

      await expect(deleteSession('session-1', 'user-1')).resolves.toBeUndefined();
      expect(mockPrisma.readingSession.delete).toHaveBeenCalledWith({
        where: { id: 'session-1' },
      });
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.readingSession.findFirst.mockResolvedValue(null);

      await expect(deleteSession('nonexistent', 'user-1')).rejects.toThrow(
        'ReadingSession',
      );
    });
  });

  describe('recordRead', () => {
    it('should add a new reading to the session', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        readings: [],
        total_questions: 0,
        created_at: new Date('2025-01-01'),
      };
      mockPrisma.readingSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.readingSession.update.mockResolvedValue({
        ...mockSession,
        readings: [{ asset_id: 'asset-1', read_at: '2025-06-01T00:00:00.000Z', questions_asked: 5 }],
        total_questions: 5,
      });

      const result = await recordRead('session-1', 'user-1', 'asset-1', 5);

      expect(result.readings).toHaveLength(1);
      expect(result.total_questions).toBe(5);
      expect(mockPrisma.readingSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          readings: expect.arrayContaining([
            expect.objectContaining({ asset_id: 'asset-1', questions_asked: 5 }),
          ]),
          total_questions: 5,
        }),
      });
    });

    it('should update existing reading in the session', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        readings: [
          { asset_id: 'asset-1', read_at: '2025-01-01T00:00:00.000Z', questions_asked: 3 },
        ],
        total_questions: 3,
        created_at: new Date('2025-01-01'),
      };
      mockPrisma.readingSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.readingSession.update.mockResolvedValue({
        ...mockSession,
        readings: [
          { asset_id: 'asset-1', read_at: '2025-06-01T00:00:00.000Z', questions_asked: 8 },
        ],
        total_questions: 8,
      });

      const result = await recordRead('session-1', 'user-1', 'asset-1', 5);

      expect(result.readings).toHaveLength(1);
      expect(result.total_questions).toBe(8);
    });

    it('should handle session with null readings', async () => {
      const mockSession = {
        id: 'session-1',
        user_id: 'user-1',
        readings: null,
        total_questions: 0,
        created_at: new Date('2025-01-01'),
      };
      mockPrisma.readingSession.findFirst.mockResolvedValue(mockSession);
      mockPrisma.readingSession.update.mockResolvedValue({
        ...mockSession,
        readings: [{ asset_id: 'asset-1', read_at: '2025-06-01T00:00:00.000Z', questions_asked: 0 }],
        total_questions: 0,
      });

      const result = await recordRead('session-1', 'user-1', 'asset-1');

      expect(result.readings).toHaveLength(1);
    });

    it('should throw NotFoundError when session not found', async () => {
      mockPrisma.readingSession.findFirst.mockResolvedValue(null);

      await expect(recordRead('nonexistent', 'user-1', 'asset-1')).rejects.toThrow(
        'ReadingSession',
      );
    });
  });

  describe('getStats', () => {
    it('should return correct aggregated stats for a user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-1',
          readings: [{ asset_id: 'a' }, { asset_id: 'b' }],
          total_questions: 5,
          created_at: new Date('2025-01-01'),
        },
        {
          id: 'session-2',
          user_id: 'user-1',
          readings: [{ asset_id: 'c' }],
          total_questions: 3,
          created_at: new Date('2025-06-01'),
        },
      ];
      mockPrisma.readingSession.findMany.mockResolvedValue(mockSessions);

      const stats = await getStats('user-1');

      expect(stats.total_sessions).toBe(2);
      expect(stats.total_readings).toBe(3);
      expect(stats.total_questions).toBe(8);
    });

    it('should return zeros for a user with no sessions', async () => {
      mockPrisma.readingSession.findMany.mockResolvedValue([]);

      const stats = await getStats('user-no-sessions');

      expect(stats.total_sessions).toBe(0);
      expect(stats.total_readings).toBe(0);
      expect(stats.total_questions).toBe(0);
    });

    it('should handle sessions with null readings', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: 'user-1',
          readings: null,
          total_questions: 2,
          created_at: new Date(),
        },
      ];
      mockPrisma.readingSession.findMany.mockResolvedValue(mockSessions);

      const stats = await getStats('user-1');

      expect(stats.total_sessions).toBe(1);
      expect(stats.total_readings).toBe(0);
      expect(stats.total_questions).toBe(2);
    });
  });
});

import { PrismaClient } from '@prisma/client';
import * as service from './service';
import { NotFoundError, ValidationError } from '../shared/errors';

const {
  listQuestions,
  getQuestion,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listAnswers,
  createAnswer,
  upvoteAnswer,
  downvoteAnswer,
  acceptAnswer,
} = service;

const mockPrisma = {
  $transaction: jest.fn(),
  question: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  questionAnswer: {
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
} as any;

describe('Questions Service', () => {
  beforeAll(() => {
    service.setPrisma(mockPrisma as unknown as PrismaClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listQuestions', () => {
    it('should return paginated questions sorted by newest', async () => {
      const items = [{ question_id: 'q-1', title: 'Test' }];
      mockPrisma.question.findMany.mockResolvedValue(items);
      mockPrisma.question.count.mockResolvedValue(1);

      const result = await listQuestions({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by tags', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);

      await listQuestions({ tags: ['typescript', 'api'] });

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tags: { hasSome: ['typescript', 'api'] } }) }),
      );
    });

    it('should filter unanswered questions', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);

      await listQuestions({ state: undefined }, 20, 0, 'unanswered');

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ answer_count: 0 }) }),
      );
    });

    it('should sort by votes', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);

      await listQuestions({}, 20, 0, 'votes');

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { answer_count: 'desc' } }),
      );
    });
  });

  describe('getQuestion', () => {
    it('should return a question with answers', async () => {
      const mockQuestion = {
        question_id: 'q-1',
        title: 'How do I use TypeScript?',
        answers: [{ answer_id: 'a-1' }],
      };
      mockPrisma.question.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.question.update.mockResolvedValue({ ...mockQuestion, views: 1 });

      const result = await getQuestion('q-1');

      expect(result.question_id).toBe('q-1');
    });

    it('should throw NotFoundError when question does not exist', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(getQuestion('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should increment view count', async () => {
      const mockQuestion = { question_id: 'q-1', views: 5, answers: [] };
      mockPrisma.question.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.question.update.mockResolvedValue({ ...mockQuestion, views: 6 });

      await getQuestion('q-1');

      expect(mockPrisma.question.update).toHaveBeenCalledWith({
        where: { question_id: 'q-1' },
        data: { views: 6 },
      });
    });
  });

  describe('createQuestion', () => {
    it('should create a question with default values', async () => {
      const mockQuestion = {
        question_id: expect.any(String),
        title: 'New Question',
        body: 'Body content',
        tags: ['tag1'],
        author: 'node-1',
        state: 'parsed',
        safety_score: 1.0,
        safety_flags: [],
        bounty: 0,
        views: 0,
        answer_count: 0,
      };
      mockPrisma.question.create.mockResolvedValue({ ...mockQuestion, question_id: 'q-1' });

      const result = await createQuestion('node-1', 'New Question', 'Body content', ['tag1'], 0);

      expect(result.question_id).toBeDefined();
      expect(result.state).toBe('parsed');
      expect(result.safety_score).toBe(1.0);
    });
  });

  describe('updateQuestion', () => {
    it('should update question fields', async () => {
      const mockQuestion = { question_id: 'q-1', author: 'node-1', title: 'Old', body: 'Old', tags: [], bounty: 0 };
      mockPrisma.question.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.question.update.mockResolvedValue({ ...mockQuestion, title: 'New Title' });

      const result = await updateQuestion('q-1', 'node-1', { title: 'New Title' });

      expect(result.title).toBe('New Title');
    });

    it('should reject update by non-author', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({ question_id: 'q-1', author: 'node-1' });

      await expect(updateQuestion('q-1', 'node-2', { title: 'Hack' })).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when question does not exist', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(updateQuestion('nonexistent', 'node-1', { title: 'x' })).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteQuestion', () => {
    it('should delete question by author', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({ question_id: 'q-1', author: 'node-1' });
      mockPrisma.question.delete.mockResolvedValue({ question_id: 'q-1' });

      await expect(deleteQuestion('q-1', 'node-1')).resolves.not.toThrow();
      expect(mockPrisma.question.delete).toHaveBeenCalledWith({ where: { question_id: 'q-1' } });
    });

    it('should reject delete by non-author', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({ question_id: 'q-1', author: 'node-1' });

      await expect(deleteQuestion('q-1', 'node-2')).rejects.toThrow(ValidationError);
    });
  });

  describe('createAnswer', () => {
    it('should create an answer and increment answer_count', async () => {
      const mockQuestion = { question_id: 'q-1', answer_count: 2 };
      mockPrisma.question.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.$transaction.mockResolvedValue([{
        answer_id: 'a-1',
        question_id: 'q-1',
        accepted: false,
        upvotes: 0,
        downvotes: 0,
      }]);
      mockPrisma.question.update.mockResolvedValue({ ...mockQuestion, answer_count: 3 });

      const result = await createAnswer('q-1', 'node-2', 'This is an answer');

      expect(result.answer_id).toBeDefined();
      expect(result.accepted).toBe(false);
    });

    it('should throw NotFoundError when question does not exist', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(createAnswer('nonexistent', 'node-1', 'answer')).rejects.toThrow(NotFoundError);
    });
  });

  describe('listAnswers', () => {
    it('should return paginated answers for a question', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({ question_id: 'q-1' });
      const answers = [{ answer_id: 'a-1' }, { answer_id: 'a-2' }];
      mockPrisma.questionAnswer.findMany.mockResolvedValue(answers);
      mockPrisma.questionAnswer.count.mockResolvedValue(2);

      const result = await listAnswers('q-1', 20, 0);

      expect(result.items).toHaveLength(2);
    });

    it('should throw NotFoundError when question does not exist', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(listAnswers('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('upvoteAnswer', () => {
    it('should increment upvote count', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({ answer_id: 'a-1', upvotes: 5 });
      mockPrisma.questionAnswer.update.mockResolvedValue({ answer_id: 'a-1', upvotes: 6 });

      await upvoteAnswer('a-1');

      expect(mockPrisma.questionAnswer.update).toHaveBeenCalledWith({
        where: { answer_id: 'a-1' },
        data: { upvotes: 6 },
      });
    });

    it('should throw NotFoundError when answer does not exist', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue(null);

      await expect(upvoteAnswer('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('downvoteAnswer', () => {
    it('should increment downvote count', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({ answer_id: 'a-1', downvotes: 0 });
      mockPrisma.questionAnswer.update.mockResolvedValue({ answer_id: 'a-1', downvotes: 1 });

      await downvoteAnswer('a-1');

      expect(mockPrisma.questionAnswer.update).toHaveBeenCalledWith({
        where: { answer_id: 'a-1' },
        data: { downvotes: 1 },
      });
    });
  });

  describe('acceptAnswer', () => {
    it('should accept an answer and unaccept previous accepted answer', async () => {
      const mockAnswer = {
        answer_id: 'a-2',
        question_id: 'q-1',
        question: { question_id: 'q-1', author: 'node-1' },
      };
      mockPrisma.questionAnswer.findUnique.mockResolvedValue(mockAnswer);
      mockPrisma.questionAnswer.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.questionAnswer.update.mockResolvedValue({ ...mockAnswer, accepted: true });

      await acceptAnswer('a-2', 'node-1');

      expect(mockPrisma.questionAnswer.updateMany).toHaveBeenCalledWith({
        where: { question_id: 'q-1', accepted: true },
        data: { accepted: false },
      });
    });

    it('should reject accept by non-question-author', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', author: 'node-1' },
      });

      await expect(acceptAnswer('a-1', 'node-2')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when answer does not exist', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue(null);

      await expect(acceptAnswer('nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });
  });
});

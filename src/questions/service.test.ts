import { PrismaClient } from '@prisma/client';
const mockAddPoints = jest.fn();

jest.mock('../reputation/service', () => ({
  ...jest.requireActual('../reputation/service'),
  addPoints: (...args: unknown[]) => mockAddPoints(...args),
}));

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
    mockPrisma.$transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') {
        return operation(mockPrisma);
      }
      return operation;
    });
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

    it('should exclude reserved review questions from public listings', async () => {
      mockPrisma.question.findMany.mockResolvedValue([]);
      mockPrisma.question.count.mockResolvedValue(0);

      await listQuestions({});

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            NOT: expect.arrayContaining([
              { tags: { has: 'review' } },
              { tags: { has: 'service_review' } },
              { tags: { has: 'worker_review' } },
              { tags: { has: 'task_commitment' } },
            ]),
          }),
        }),
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

    it('should hide reserved review questions from public reads', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'review:asset-1:node-1',
        tags: ['review', 'asset:asset-1', 'rating:5'],
        answers: [],
      });

      await expect(getQuestion('review:asset-1:node-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.question.update).not.toHaveBeenCalled();
    });

    it('should hide reserved service review questions from public reads', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'srvrev-stable',
        tags: ['service_review', 'service:svc-1', 'rating:5'],
        answers: [],
      });

      await expect(getQuestion('srvrev-stable')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.question.update).not.toHaveBeenCalled();
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

    it('should reject reserved review tags', async () => {
      await expect(
        createQuestion('node-1', 'New Question', 'Body content', ['review', 'asset:asset-1', 'rating:5'], 0),
      ).rejects.toThrow('review tags are reserved');

      expect(mockPrisma.question.create).not.toHaveBeenCalled();
    });

    it('should reject reserved service review tags', async () => {
      await expect(
        createQuestion('node-1', 'New Question', 'Body content', ['service_review', 'service:svc-1', 'rating:5'], 0),
      ).rejects.toThrow('review tags are reserved');

      expect(mockPrisma.question.create).not.toHaveBeenCalled();
    });

    it('should reject reserved worker review tags', async () => {
      await expect(
        createQuestion('node-1', 'New Question', 'Body content', ['worker_review', 'worker_review:node-2', 'rating:5'], 0),
      ).rejects.toThrow('review tags are reserved');

      expect(mockPrisma.question.create).not.toHaveBeenCalled();
    });

    it('should reject reserved task commitment tags', async () => {
      await expect(
        createQuestion('node-1', 'New Question', 'Body content', ['task_commitment', 'task_commitment:p-1:t-1'], 0),
      ).rejects.toThrow('review tags are reserved');

      expect(mockPrisma.question.create).not.toHaveBeenCalled();
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

    it('should reject reserved review tags during updates', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'q-1',
        author: 'node-1',
        title: 'Old',
        body: 'Old',
        tags: [],
        bounty: 0,
      });

      await expect(
        updateQuestion('q-1', 'node-1', { tags: ['review'] }),
      ).rejects.toThrow('review tags are reserved');

      expect(mockPrisma.question.update).not.toHaveBeenCalled();
    });

    it('should hide reserved review questions from generic updates', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'review:asset-1:node-1',
        author: 'node-1',
        tags: ['review', 'asset:asset-1', 'rating:5'],
      });

      await expect(
        updateQuestion('review:asset-1:node-1', 'node-1', { title: 'Hack' }),
      ).rejects.toThrow(NotFoundError);
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

    it('should hide reserved review questions from generic deletes', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'review:asset-1:node-1',
        author: 'node-1',
        tags: ['review', 'asset:asset-1', 'rating:5'],
      });

      await expect(deleteQuestion('review:asset-1:node-1', 'node-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.question.delete).not.toHaveBeenCalled();
    });
  });

  describe('createAnswer', () => {
    it('should create an answer and increment answer_count', async () => {
      const mockQuestion = { question_id: 'q-1', answer_count: 2 };
      mockPrisma.question.findUnique.mockResolvedValue(mockQuestion);
      mockPrisma.questionAnswer.create.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        accepted: false,
        upvotes: 0,
        downvotes: 0,
      });
      mockPrisma.question.update.mockResolvedValue({ ...mockQuestion, answer_count: 3 });

      const result = await createAnswer('q-1', 'node-2', 'This is an answer');

      expect(result.answer_id).toBeDefined();
      expect(result.accepted).toBe(false);
      expect(mockPrisma.question.update).toHaveBeenCalledWith({
        where: { question_id: 'q-1' },
        data: { answer_count: { increment: 1 } },
      });
    });

    it('should throw NotFoundError when question does not exist', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null);

      await expect(createAnswer('nonexistent', 'node-1', 'answer')).rejects.toThrow(NotFoundError);
    });

    it('should hide reserved review questions from generic answers', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'review:asset-1:node-1',
        tags: ['review', 'asset:asset-1', 'rating:5'],
      });

      await expect(createAnswer('review:asset-1:node-1', 'node-1', 'answer')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should hide reserved service review questions from generic answers', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'service-review:svc-1:node-1',
        tags: ['service_review', 'service:svc-1', 'rating:5'],
      });

      await expect(createAnswer('service-review:svc-1:node-1', 'node-1', 'answer')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
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

    it('should hide reserved review questions from answer listings', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'review:asset-1:node-1',
        tags: ['review', 'asset:asset-1', 'rating:5'],
      });

      await expect(listAnswers('review:asset-1:node-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.findMany).not.toHaveBeenCalled();
    });

    it('should hide reserved service review questions from answer listings', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        question_id: 'service-review:svc-1:node-1',
        tags: ['service_review', 'service:svc-1', 'rating:5'],
      });

      await expect(listAnswers('service-review:svc-1:node-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.findMany).not.toHaveBeenCalled();
    });
  });

  describe('upvoteAnswer', () => {
    it('should increment upvote count', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        author: 'node-answer',
        upvotes: 5,
        question: { question_id: 'q-1', tags: [] },
      });
      mockPrisma.questionAnswer.update.mockResolvedValue({ answer_id: 'a-1', upvotes: 6 });
      mockAddPoints.mockResolvedValue({
        node_id: 'node-answer',
        score: 51,
      });

      await upvoteAnswer('q-1', 'a-1');

      expect(mockPrisma.questionAnswer.update).toHaveBeenCalledWith({
        where: { answer_id: 'a-1' },
        data: { upvotes: { increment: 1 } },
      });
      expect(mockAddPoints).toHaveBeenCalledWith(
        'node-answer',
        'answer_upvoted',
        mockPrisma,
      );
    });

    it('should throw NotFoundError when answer does not exist', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue(null);

      await expect(upvoteAnswer('q-1', 'nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should hide answers attached to reserved review questions', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', tags: ['review', 'asset:asset-1', 'rating:5'] },
      });

      await expect(upvoteAnswer('q-1', 'a-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.update).not.toHaveBeenCalled();
    });

    it('should hide answers attached to reserved service review questions', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', tags: ['service_review', 'service:svc-1', 'rating:5'] },
      });

      await expect(upvoteAnswer('q-1', 'a-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.update).not.toHaveBeenCalled();
    });
  });

  describe('downvoteAnswer', () => {
    it('should increment downvote count', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        author: 'node-answer',
        downvotes: 0,
        question: { question_id: 'q-1', tags: [] },
      });
      mockPrisma.questionAnswer.update.mockResolvedValue({ answer_id: 'a-1', downvotes: 1 });
      mockAddPoints.mockResolvedValue({
        node_id: 'node-answer',
        score: 48,
      });

      await downvoteAnswer('q-1', 'a-1');

      expect(mockPrisma.questionAnswer.update).toHaveBeenCalledWith({
        where: { answer_id: 'a-1' },
        data: { downvotes: { increment: 1 } },
      });
      expect(mockAddPoints).toHaveBeenCalledWith(
        'node-answer',
        'answer_downvoted',
        mockPrisma,
      );
    });

    it('should hide answers attached to reserved review questions', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', tags: ['review', 'asset:asset-1', 'rating:5'] },
      });

      await expect(downvoteAnswer('q-1', 'a-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.update).not.toHaveBeenCalled();
    });

    it('should hide answers attached to reserved service review questions', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', tags: ['service_review', 'service:svc-1', 'rating:5'] },
      });

      await expect(downvoteAnswer('q-1', 'a-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.update).not.toHaveBeenCalled();
    });
  });

  describe('acceptAnswer', () => {
    it('should accept an answer and unaccept previous accepted answer', async () => {
      const mockAnswer = {
        answer_id: 'a-2',
        question_id: 'q-1',
        author: 'node-answer',
        accepted: false,
        question: { question_id: 'q-1', author: 'node-1', tags: [] },
      };
      mockPrisma.questionAnswer.findUnique.mockResolvedValue(mockAnswer);
      mockPrisma.questionAnswer.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.questionAnswer.update.mockResolvedValue({ ...mockAnswer, accepted: true });
      mockAddPoints.mockResolvedValue({
        node_id: 'node-answer',
        score: 65,
      });

      await acceptAnswer('q-1', 'a-2', 'node-1');

      expect(mockPrisma.questionAnswer.updateMany).toHaveBeenCalledWith({
        where: { question_id: 'q-1', accepted: true },
        data: { accepted: false },
      });
      expect(mockPrisma.questionAnswer.update).toHaveBeenCalledWith({
        where: { answer_id: 'a-2' },
        data: { accepted: true },
      });
      expect(mockAddPoints).toHaveBeenCalledWith(
        'node-answer',
        'answer_accepted',
        mockPrisma,
      );
    });

    it('should not double-award reputation when an already accepted answer is re-accepted', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-2',
        question_id: 'q-1',
        author: 'node-answer',
        accepted: true,
        question: { question_id: 'q-1', author: 'node-1', tags: [] },
      });
      mockPrisma.questionAnswer.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.questionAnswer.update.mockResolvedValue({ answer_id: 'a-2', accepted: true });

      await acceptAnswer('q-1', 'a-2', 'node-1');

      expect(mockAddPoints).not.toHaveBeenCalled();
    });

    it('should reject accept by non-question-author', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', author: 'node-1', tags: [] },
      });

      await expect(acceptAnswer('q-1', 'a-1', 'node-2')).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError when answer does not exist', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue(null);

      await expect(acceptAnswer('q-1', 'nonexistent', 'node-1')).rejects.toThrow(NotFoundError);
    });

    it('should hide answers attached to reserved review questions', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', author: 'node-1', tags: ['review', 'asset:asset-1', 'rating:5'] },
      });

      await expect(acceptAnswer('q-1', 'a-1', 'node-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.updateMany).not.toHaveBeenCalled();
    });

    it('should hide answers attached to reserved service review questions', async () => {
      mockPrisma.questionAnswer.findUnique.mockResolvedValue({
        answer_id: 'a-1',
        question_id: 'q-1',
        question: { question_id: 'q-1', author: 'node-1', tags: ['service_review', 'service:svc-1', 'rating:5'] },
      });

      await expect(acceptAnswer('q-1', 'a-1', 'node-1')).rejects.toThrow(NotFoundError);
      expect(mockPrisma.questionAnswer.updateMany).not.toHaveBeenCalled();
    });
  });
});

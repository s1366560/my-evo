import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  (prisma as unknown) = client;
}

export async function listQuestions(
  filters: { tags?: string[]; state?: string },
  limit = 20,
  offset = 0,
  sort: 'newest' | 'votes' | 'unanswered' = 'newest',
) {
  const where: Record<string, unknown> = {};
  if (filters.state) {
    where.state = filters.state;
  }
  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }
  if (sort === 'unanswered') {
    where.answer_count = 0;
  }

  let orderBy: Record<string, string> = { created_at: 'desc' };
  if (sort === 'votes') {
    orderBy = { answer_count: 'desc' };
  }

  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.question.count({ where }),
  ]);

  return { items, total };
}

export async function getQuestion(questionId: string) {
  const question = await prisma.question.findUnique({
    where: { question_id: questionId },
    include: { answers: { orderBy: { created_at: 'asc' } } },
  });

  if (!question) {
    throw new NotFoundError('Question', questionId);
  }

  // Increment view count
  await prisma.question.update({
    where: { question_id: questionId },
    data: { views: question.views + 1 },
  });

  return question;
}

export async function createQuestion(
  author: string,
  title: string,
  body: string,
  tags: string[],
  bounty: number,
) {
  const questionId = crypto.randomUUID();
  const now = new Date();

  const question = await prisma.question.create({
    data: {
      question_id: questionId,
      title,
      body,
      tags,
      author,
      state: 'parsed',
      safety_score: 1.0,
      safety_flags: [],
      bounty,
      views: 0,
      answer_count: 0,
      created_at: now,
      updated_at: now,
    },
  });

  return question;
}

export async function updateQuestion(
  questionId: string,
  author: string,
  updates: { title?: string; body?: string; tags?: string[]; bounty?: number },
) {
  const question = await prisma.question.findUnique({
    where: { question_id: questionId },
  });

  if (!question) {
    throw new NotFoundError('Question', questionId);
  }

  if (question.author !== author) {
    throw new ValidationError('Only the author can update this question');
  }

  const updated = await prisma.question.update({
    where: { question_id: questionId },
    data: {
      title: updates.title ?? question.title,
      body: updates.body ?? question.body,
      tags: updates.tags ?? question.tags,
      bounty: updates.bounty ?? question.bounty,
      updated_at: new Date(),
    },
  });

  return updated;
}

export async function deleteQuestion(questionId: string, author: string) {
  const question = await prisma.question.findUnique({
    where: { question_id: questionId },
  });

  if (!question) {
    throw new NotFoundError('Question', questionId);
  }

  if (question.author !== author) {
    throw new ValidationError('Only the author can delete this question');
  }

  await prisma.question.delete({
    where: { question_id: questionId },
  });
}

export async function listAnswers(questionId: string, limit = 20, offset = 0) {
  const question = await prisma.question.findUnique({
    where: { question_id: questionId },
  });

  if (!question) {
    throw new NotFoundError('Question', questionId);
  }

  const [items, total] = await Promise.all([
    prisma.questionAnswer.findMany({
      where: { question_id: questionId },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.questionAnswer.count({
      where: { question_id: questionId },
    }),
  ]);

  return { items, total };
}

export async function createAnswer(questionId: string, author: string, body: string) {
  const question = await prisma.question.findUnique({
    where: { question_id: questionId },
  });

  if (!question) {
    throw new NotFoundError('Question', questionId);
  }

  const answerId = crypto.randomUUID();
  const now = new Date();

  const [answer] = await prisma.$transaction([
    prisma.questionAnswer.create({
      data: {
        answer_id: answerId,
        question_id: questionId,
        body,
        author,
        accepted: false,
        upvotes: 0,
        downvotes: 0,
        created_at: now,
      },
    }),
    prisma.question.update({
      where: { question_id: questionId },
      data: { answer_count: question.answer_count + 1 },
    }),
  ]);

  return answer;
}

export async function upvoteAnswer(answerId: string) {
  const answer = await prisma.questionAnswer.findUnique({
    where: { answer_id: answerId },
  });

  if (!answer) {
    throw new NotFoundError('Answer', answerId);
  }

  await prisma.questionAnswer.update({
    where: { answer_id: answerId },
    data: { upvotes: answer.upvotes + 1 },
  });
}

export async function downvoteAnswer(answerId: string) {
  const answer = await prisma.questionAnswer.findUnique({
    where: { answer_id: answerId },
  });

  if (!answer) {
    throw new NotFoundError('Answer', answerId);
  }

  await prisma.questionAnswer.update({
    where: { answer_id: answerId },
    data: { downvotes: answer.downvotes + 1 },
  });
}

export async function acceptAnswer(answerId: string, questionAuthor: string) {
  const answer = await prisma.questionAnswer.findUnique({
    where: { answer_id: answerId },
    include: { question: true },
  });

  if (!answer) {
    throw new NotFoundError('Answer', answerId);
  }

  if (answer.question.author !== questionAuthor) {
    throw new ValidationError('Only the question author can accept an answer');
  }

  // Unaccept any previously accepted answer
  await prisma.questionAnswer.updateMany({
    where: { question_id: answer.question_id, accepted: true },
    data: { accepted: false },
  });

  await prisma.questionAnswer.update({
    where: { answer_id: answerId },
    data: { accepted: true },
  });
}

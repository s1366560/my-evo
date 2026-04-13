import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';
import { createUnconfiguredPrismaClient } from '../shared/prisma';
import { addPoints } from '../reputation/service';

let prisma = createUnconfiguredPrismaClient();
const RESERVED_INTERNAL_TAGS = new Set([
  'review',
  'service_review',
  'worker_review',
  'task_commitment',
]);
const RESERVED_TAG_PREFIXES = [
  'asset:',
  'service:',
  'rating:',
  'worker_review:',
  'worker_task:',
  'task_commitment:',
];

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

function hasReservedReviewTag(tags: string[]): boolean {
  return tags.some((tag) => {
    const normalized = tag.trim();
    return RESERVED_INTERNAL_TAGS.has(normalized)
      || RESERVED_TAG_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  });
}

function sanitizeQuestionTags(tags: string[]): string[] {
  const normalizedTags = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  if (hasReservedReviewTag(normalizedTags)) {
    throw new ValidationError('review tags are reserved');
  }

  return normalizedTags;
}

function requirePublicQuestion<T extends { question_id: string; tags: string[] }>(
  question: T | null,
): T {
  const tags = Array.isArray(question?.tags) ? question.tags : [];
  if (!question || hasReservedReviewTag(tags)) {
    throw new NotFoundError('Question', question?.question_id ?? 'unknown');
  }

  return question;
}

async function getPublicAnswer(
  questionId: string,
  answerId: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const answer = await client.questionAnswer.findUnique({
    where: { answer_id: answerId },
    include: {
      question: true,
    },
  });

  const questionTags = Array.isArray(answer?.question?.tags) ? answer.question.tags : [];
  if (
    !answer
    || answer.question_id !== questionId
    || hasReservedReviewTag(questionTags)
  ) {
    throw new NotFoundError('Answer', answerId);
  }

  return answer;
}

export async function listQuestions(
  filters: { tags?: string[]; state?: string },
  limit = 20,
  offset = 0,
  sort: 'newest' | 'votes' | 'unanswered' = 'newest',
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const where: Record<string, unknown> = {};
  where.NOT = Array.from(RESERVED_INTERNAL_TAGS).map((tag) => ({ tags: { has: tag } }));
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
    client.question.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    client.question.count({ where }),
  ]);

  return { items, total };
}

export async function getQuestion(questionId: string, prismaClient?: PrismaClient) {
  const client = getPrismaClient(prismaClient);
  const question = requirePublicQuestion(await client.question.findUnique({
    where: { question_id: questionId },
    include: { answers: { orderBy: { created_at: 'asc' } } },
  }));

  // Increment view count
  await client.question.update({
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
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const questionId = crypto.randomUUID();
  const now = new Date();
  const safeTags = sanitizeQuestionTags(tags);

  const question = await client.question.create({
    data: {
      question_id: questionId,
      title,
      body,
      tags: safeTags,
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
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const question = requirePublicQuestion(await client.question.findUnique({
    where: { question_id: questionId },
  }));

  if (question.author !== author) {
    throw new ValidationError('Only the author can update this question');
  }

  const nextTags = updates.tags !== undefined
    ? sanitizeQuestionTags(updates.tags)
    : question.tags;

  const updated = await client.question.update({
    where: { question_id: questionId },
    data: {
      title: updates.title ?? question.title,
      body: updates.body ?? question.body,
      tags: nextTags,
      bounty: updates.bounty ?? question.bounty,
      updated_at: new Date(),
    },
  });

  return updated;
}

export async function deleteQuestion(
  questionId: string,
  author: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const question = requirePublicQuestion(await client.question.findUnique({
    where: { question_id: questionId },
  }));

  if (question.author !== author) {
    throw new ValidationError('Only the author can delete this question');
  }

  await client.question.delete({
    where: { question_id: questionId },
  });
}

export async function listAnswers(
  questionId: string,
  limit = 20,
  offset = 0,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  requirePublicQuestion(await client.question.findUnique({
    where: { question_id: questionId },
  }));

  const [items, total] = await Promise.all([
    client.questionAnswer.findMany({
      where: { question_id: questionId },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: offset,
    }),
    client.questionAnswer.count({
      where: { question_id: questionId },
    }),
  ]);

  return { items, total };
}

export async function createAnswer(
  questionId: string,
  author: string,
  body: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const question = requirePublicQuestion(await client.question.findUnique({
    where: { question_id: questionId },
  }));

  const answerId = crypto.randomUUID();
  const now = new Date();

  const answer = await client.$transaction(async (tx) => {
    const createdAnswer = await tx.questionAnswer.create({
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
    });
    await tx.question.update({
      where: { question_id: questionId },
      data: { answer_count: { increment: 1 } },
    });
    return createdAnswer;
  });

  return answer;
}

export async function upvoteAnswer(
  questionId: string,
  answerId: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const answer = await getPublicAnswer(questionId, answerId, client);

  await client.$transaction(async (tx) => {
    await tx.questionAnswer.update({
      where: { answer_id: answerId },
      data: { upvotes: { increment: 1 } },
    });
    await addPoints(answer.author, 'answer_upvoted', tx as unknown as PrismaClient);
  });
}

export async function downvoteAnswer(
  questionId: string,
  answerId: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const answer = await getPublicAnswer(questionId, answerId, client);

  await client.$transaction(async (tx) => {
    await tx.questionAnswer.update({
      where: { answer_id: answerId },
      data: { downvotes: { increment: 1 } },
    });
    await addPoints(answer.author, 'answer_downvoted', tx as unknown as PrismaClient);
  });
}

export async function acceptAnswer(
  questionId: string,
  answerId: string,
  questionAuthor: string,
  prismaClient?: PrismaClient,
) {
  const client = getPrismaClient(prismaClient);
  const answer = await getPublicAnswer(questionId, answerId, client);

  if (answer.question.author !== questionAuthor) {
    throw new ValidationError('Only the question author can accept an answer');
  }

  await client.$transaction(async (tx) => {
    await tx.questionAnswer.updateMany({
      where: { question_id: answer.question_id, accepted: true },
      data: { accepted: false },
    });

    await tx.questionAnswer.update({
      where: { answer_id: answerId },
      data: { accepted: true },
    });

    if (!answer.accepted) {
      await addPoints(answer.author, 'answer_accepted', tx as unknown as PrismaClient);
    }
  });
}

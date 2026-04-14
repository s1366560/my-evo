import { Prisma, type PrismaClient } from '@prisma/client';
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
const L1_FORBIDDEN_PATTERNS: Array<{ flag: string; pattern: RegExp }> = [
  { flag: 'exploit', pattern: /exploit/i },
  { flag: 'malware', pattern: /malware/i },
  { flag: 'theft', pattern: /theft/i },
  { flag: 'jailbreak', pattern: /jailbreak/i },
  { flag: 'injection', pattern: /injection/i },
  { flag: 'bypass_auth', pattern: /bypass.*auth/i },
  { flag: 'credential_theft', pattern: /steal.*credential/i },
];
const L2_OBFUSCATION_PATTERNS: Array<{ flag: string; pattern: RegExp }> = [
  { flag: 'hex_escape', pattern: /\\x[0-9a-f]{2}/i },
  { flag: 'unicode_escape', pattern: /\\u[0-9a-f]{4}/i },
  { flag: 'eval_usage', pattern: /eval\s*\(/i },
  { flag: 'base64_obfuscation', pattern: /btoa|atob/i },
  { flag: 'charcode_construction', pattern: /String\.fromCharCode/i },
  { flag: 'document_write', pattern: /document\.write/i },
  { flag: 'html_injection', pattern: /innerHTML\s*=/i },
];

type QuestionSafetyDecision = 'auto_approve' | 'pass_to_review' | 'auto_reject';

interface QuestionSafetyScanRecord {
  layer: 'layer1_pattern_detection' | 'layer2_obfuscation_detection' | 'layer3_content_policy';
  score: number;
  flags: string[];
  decision: QuestionSafetyDecision;
  details: Record<string, unknown>;
}

interface QuestionSafetyAssessment {
  score: number;
  flags: string[];
  decision: QuestionSafetyDecision;
  state: 'approved' | 'pending' | 'rejected';
  scans: QuestionSafetyScanRecord[];
}

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

function countWords(text: string): number {
  const words = text.match(/\S+/g);
  return words ? words.length : 0;
}

function getUniqueWordRatio(text: string): number {
  const words = text.toLowerCase().match(/[a-z0-9_]+/gi);
  if (!words || words.length === 0) {
    return 1;
  }

  return new Set(words).size / words.length;
}

function assessQuestionSafety(title: string, body: string): QuestionSafetyAssessment {
  const text = `${title}\n${body}`.trim();
  const l1Flags = L1_FORBIDDEN_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ flag }) => flag);
  const l2Flags = L2_OBFUSCATION_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ flag }) => flag);
  const l3Flags: string[] = [];

  let score = 1.0;
  const wordCount = countWords(text);
  const uniqueWordRatio = getUniqueWordRatio(text);
  const urlCount = (text.match(/https?:\/\/\S+/g) ?? []).length;

  if (text.length > 10000) {
    score -= 0.1;
    l3Flags.push('length_over_10000');
  }
  if (uniqueWordRatio < 0.3) {
    score -= 0.2;
    l3Flags.push('repetition_ratio_below_0_3');
  }
  if (!/[?？]/.test(text)) {
    score -= 0.15;
    l3Flags.push('no_question_mark');
  }
  if (urlCount > 3) {
    score -= 0.1;
    l3Flags.push('more_than_3_urls');
  }
  if (wordCount < 3) {
    score -= 0.3;
    l3Flags.push('fewer_than_3_words');
  }

  const normalizedScore = Math.max(0, Number(score.toFixed(2)));
  const decision: QuestionSafetyDecision = l1Flags.length > 0
    ? 'auto_reject'
    : normalizedScore >= 0.9 && l2Flags.length === 0
      ? 'auto_approve'
      : normalizedScore >= 0.5
        ? 'pass_to_review'
        : 'auto_reject';
  const state = decision === 'auto_approve'
    ? 'approved'
    : decision === 'pass_to_review'
      ? 'pending'
      : 'rejected';

  return {
    score: normalizedScore,
    flags: [...l1Flags, ...l2Flags, ...l3Flags],
    decision,
    state,
    scans: [
      {
        layer: 'layer1_pattern_detection',
        score: l1Flags.length > 0 ? 0 : 1,
        flags: l1Flags,
        decision: l1Flags.length > 0 ? 'auto_reject' : 'auto_approve',
        details: { matched_patterns: l1Flags },
      },
      {
        layer: 'layer2_obfuscation_detection',
        score: l2Flags.length > 0 ? 0.6 : 1,
        flags: l2Flags,
        decision: l2Flags.length > 0 ? 'pass_to_review' : 'auto_approve',
        details: { matched_patterns: l2Flags },
      },
      {
        layer: 'layer3_content_policy',
        score: normalizedScore,
        flags: l3Flags,
        decision,
        details: {
          length: text.length,
          word_count: wordCount,
          unique_word_ratio: Number(uniqueWordRatio.toFixed(2)),
          url_count: urlCount,
        },
      },
    ],
  };
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
  const safety = assessQuestionSafety(title, body);

  const question = await client.$transaction(async (tx) => {
    const created = await tx.question.create({
      data: {
        question_id: questionId,
        title,
        body,
        tags: safeTags,
        author,
        state: safety.state,
        safety_score: safety.score,
        safety_flags: safety.flags,
        bounty,
        views: 0,
        answer_count: 0,
        created_at: now,
        updated_at: now,
      },
    });

    await tx.questionSecurityScan.createMany({
      data: safety.scans.map((scan) => ({
        question_id: questionId,
        scan_id: crypto.randomUUID(),
        layer: scan.layer,
        score: scan.score,
        flags: scan.flags,
        decision: scan.decision,
        details: scan.details as Prisma.InputJsonValue,
        scanned_at: now,
      })),
    });

    if (safety.decision !== 'auto_approve') {
      await tx.questionModeration.create({
        data: {
          question_id: questionId,
          decision: safety.state,
          reason: safety.decision === 'auto_reject'
            ? 'Rejected by question safety scan'
            : 'Queued for manual review by question safety scan',
          created_at: now,
        },
      });
    }

    return created;
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
  const nextTitle = updates.title ?? question.title;
  const nextBody = updates.body ?? question.body;
  const now = new Date();
  const safety = assessQuestionSafety(nextTitle, nextBody);

  const updated = await client.$transaction(async (tx) => {
    const saved = await tx.question.update({
      where: { question_id: questionId },
      data: {
        title: nextTitle,
        body: nextBody,
        tags: nextTags,
        bounty: updates.bounty ?? question.bounty,
        state: safety.state,
        safety_score: safety.score,
        safety_flags: safety.flags,
        updated_at: now,
      },
    });

    await tx.questionSecurityScan.createMany({
      data: safety.scans.map((scan) => ({
        question_id: questionId,
        scan_id: crypto.randomUUID(),
        layer: scan.layer,
        score: scan.score,
        flags: scan.flags,
        decision: scan.decision,
        details: scan.details as Prisma.InputJsonValue,
        scanned_at: now,
      })),
    });

    if (safety.decision !== 'auto_approve') {
      await tx.questionModeration.create({
        data: {
          question_id: questionId,
          decision: safety.state,
          reason: safety.decision === 'auto_reject'
            ? 'Updated content rejected by question safety scan'
            : 'Updated content queued for manual review by question safety scan',
          created_at: now,
        },
      });
    }

    return saved;
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

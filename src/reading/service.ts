import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type {
  ReadingResult,
  GeneratedQuestion,
  ExtractedEntity,
} from '../shared/types';
import {
  CONTENT_MAX_LENGTH,
  RESULT_CONTENT_LIMIT,
} from '../shared/constants';
import { ValidationError, NotFoundError } from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export async function readUrl(url: string): Promise<ReadingResult> {
  if (!url || url.trim().length === 0) {
    throw new ValidationError('URL is required');
  }

  let urlObj: URL;
  try {
    urlObj = new URL(url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  const title = urlObj.hostname;
  const mockContent = `Content fetched from ${url}. This is a mock implementation of the reading engine. ` +
    `In production, this would fetch and parse the actual URL content. ` +
    `The reading engine extracts key information, generates questions, and identifies entities from web content. ` +
    `It supports multiple content types including HTML, PDF, and plain text documents. ` +
    `The engine uses natural language processing to understand the structure and meaning of the content.`;

  const truncatedContent = mockContent.slice(0, RESULT_CONTENT_LIMIT);

  const questions = generateQuestions(truncatedContent);
  const entities = extractEntities(truncatedContent);

  const readingId = crypto.randomUUID();

  return {
    id: readingId,
    url,
    content: truncatedContent,
    title,
    summary: `Summary of content from ${urlObj.hostname}. This mock reading result demonstrates the reading engine capabilities.`,
    questions,
    keyInformation: [
      'Content source: ' + urlObj.hostname,
      'Content type: web page',
      'Reading engine version: 1.0',
    ],
    entities,
  };
}

export function generateQuestions(
  content: string,
): GeneratedQuestion[] {
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const questions: GeneratedQuestion[] = [];
  const types: GeneratedQuestion['type'][] = [
    'factual',
    'analytical',
    'comparative',
    'causal',
    'evaluative',
  ];
  const difficulties: GeneratedQuestion['difficulty'][] = [
    'easy',
    'medium',
    'hard',
  ];

  const sampleQuestions = [
    'What is the main topic discussed in this content?',
    'How does the reading engine process web content?',
    'What are the key differences between this implementation and a production system?',
    'Why is content extraction important for AI systems?',
    'What improvements would you suggest for this reading engine?',
  ];

  for (let i = 0; i < Math.min(5, sampleQuestions.length); i++) {
    questions.push({
      id: crypto.randomUUID(),
      text: sampleQuestions[i]!,
      type: types[i % types.length]!,
      difficulty: difficulties[i % difficulties.length]!,
    });
  }

  return questions;
}

export function extractEntities(
  content: string,
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [
    {
      name: 'Reading Engine',
      type: 'technology',
      mentions: 3,
    },
    {
      name: 'URL',
      type: 'concept',
      mentions: 2,
    },
    {
      name: 'NLP',
      type: 'technology',
      mentions: 1,
    },
    {
      name: 'HTML',
      type: 'technology',
      mentions: 1,
    },
    {
      name: 'PDF',
      type: 'technology',
      mentions: 1,
    },
  ];

  return entities;
}

export async function getReadingSession(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const session = await prisma.readingSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.id,
    user_id: session.user_id,
    readings: session.readings,
    total_questions: session.total_questions,
    created_at: session.created_at.toISOString(),
  };
}

export async function listReadingSessions(
  userId: string,
  limit = 20,
): Promise<Array<Record<string, unknown>>> {
  const sessions = await prisma.readingSession.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return sessions.map((s: { id: string; user_id: string; readings: unknown; total_questions: number; created_at: Date }) => ({
    id: s.id,
    user_id: s.user_id,
    readings: s.readings,
    total_questions: s.total_questions,
    created_at: s.created_at.toISOString(),
  }));
}

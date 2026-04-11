import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Agent, fetch } from 'undici';
import { EvoMapError, NotFoundError, ValidationError } from '../shared/errors';
import type { GeneratedQuestion, ExtractedEntity, ReadingResult } from '../shared/types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

export interface ReadingSessionOutput {
  id: string;
  user_id: string;
  readings: unknown[];
  total_questions: number;
  created_at: string;
}

export async function listSessions(userId: string, limit = 20): Promise<ReadingSessionOutput[]> {
  const sessions = await prisma.readingSession.findMany({
    where: { user_id: userId },
    take: limit,
    orderBy: { created_at: 'desc' },
  });
  return sessions.map(mapSession);
}

export async function createSession(
  userId: string,
  assetIds?: string[],
): Promise<ReadingSessionOutput> {
  const readings = (assetIds ?? []).map((id) => ({
    asset_id: id,
    read_at: new Date().toISOString(),
    questions_asked: 0,
  }));
  const session = await prisma.readingSession.create({
    data: {
      user_id: userId,
      readings: readings as object[],
      total_questions: 0,
    },
  });
  return mapSession(session);
}

export async function getSession(
  sessionId: string,
  userId: string,
): Promise<ReadingSessionOutput | null> {
  const session = await prisma.readingSession.findUnique({
    where: { id: sessionId },
  });
  return session && session.user_id === userId ? mapSession(session) : null;
}

export async function deleteSession(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.readingSession.findFirst({
    where: { id: sessionId, user_id: userId },
  });
  if (!session) {
    throw new NotFoundError('ReadingSession', sessionId);
  }
  await prisma.readingSession.delete({ where: { id: sessionId } });
}

export async function recordRead(
  sessionId: string,
  userId: string,
  assetId: string,
  questionsAsked?: number,
): Promise<ReadingSessionOutput> {
  const session = await prisma.readingSession.findFirst({
    where: { id: sessionId, user_id: userId },
  });
  if (!session) {
    throw new NotFoundError('ReadingSession', sessionId);
  }

  const currentReadings = (session.readings as Array<Record<string, unknown>>) ?? [];
  const existingIdx = currentReadings.findIndex(
    (r) => r.asset_id === assetId,
  );

  const questionsDelta = questionsAsked ?? 0;

  let updatedReadings: object[];
  if (existingIdx >= 0) {
    const existing = currentReadings[existingIdx]!;
    updatedReadings = currentReadings.map((r, i) =>
      i === existingIdx
        ? {
            ...r,
            read_at: new Date().toISOString(),
            questions_asked: ((r.questions_asked as number) ?? 0) + questionsDelta,
          }
        : r,
    );
  } else {
    updatedReadings = [
      ...currentReadings,
      {
        asset_id: assetId,
        read_at: new Date().toISOString(),
        questions_asked: questionsDelta,
      },
    ];
  }

  const updated = await prisma.readingSession.update({
    where: { id: sessionId },
    data: {
      readings: updatedReadings,
      total_questions: session.total_questions + questionsDelta,
    },
  });
  return mapSession(updated);
}

export async function getStats(
  userId: string,
): Promise<{ total_sessions: number; total_readings: number; total_questions: number }> {
  const sessions = await prisma.readingSession.findMany({
    where: { user_id: userId },
  });

  const totalSessions = sessions.length;
  let totalReadings = 0;
  let totalQuestions = 0;

  for (const s of sessions) {
    const readings = (s.readings as Array<Record<string, unknown>>) ?? [];
    totalReadings += readings.length;
    totalQuestions += s.total_questions;
  }

  return { total_sessions: totalSessions, total_readings: totalReadings, total_questions: totalQuestions };
}

function mapSession(s: {
  id: string;
  user_id: string;
  readings: unknown;
  total_questions: number;
  created_at: Date;
}): ReadingSessionOutput {
  return {
    id: s.id,
    user_id: s.user_id,
    readings: s.readings as unknown[],
    total_questions: s.total_questions,
    created_at: s.created_at.toISOString(),
  };
}

export const CONTENT_MAX_LENGTH = 50000;
export const RESULT_CONTENT_LIMIT = 10000;
export const READINGS_BUFFER_SIZE = 100;
export const QUESTION_TYPES = 5;
export const ENTITY_TYPES = 5;
const MAX_FETCH_BYTES = CONTENT_MAX_LENGTH * 2;
const MAX_REDIRECTS = 3;

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const QUESTION_SEQUENCE: GeneratedQuestion['type'][] = [
  'factual',
  'analytical',
  'comparative',
  'causal',
  'evaluative',
];
const FALLBACK_ENTITIES: ExtractedEntity[] = [
  { name: 'Reading Engine', type: 'technology', mentions: 3 },
  { name: 'URL', type: 'concept', mentions: 1 },
  { name: 'NLP', type: 'technology', mentions: 1 },
  { name: 'HTML', type: 'technology', mentions: 1 },
  { name: 'PDF', type: 'technology', mentions: 1 },
];
const STOP_WORDS = new Set([
  'about',
  'after',
  'also',
  'and',
  'article',
  'because',
  'between',
  'build',
  'content',
  'document',
  'example',
  'from',
  'have',
  'into',
  'more',
  'page',
  'reading',
  'that',
  'their',
  'there',
  'these',
  'this',
  'through',
  'using',
  'with',
]);
const KNOWN_LOCATIONS = new Set(['Asia', 'Europe', 'Africa', 'America', 'China', 'Japan', 'Korea']);
const recentReadingBuffer: Array<{
  reader_scope: string;
  id: string;
  url: string;
  title: string;
  summary: string;
  analyzed_at: string;
  hostname: string;
}> = [];

export interface TrendingReading {
  id: string;
  url: string;
  title: string;
  summary: string;
  analyzed_at: string;
  hostname: string;
  hits: number;
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, '\'')
      .replace(/&quot;/gi, '"'),
  );
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match || !match[1]) {
    return null;
  }
  const title = normalizeWhitespace(stripHtml(match[1]));
  return title.length > 0 ? title : null;
}

function splitSentences(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+|[\r\n]+/g)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 0);
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function isExampleHostname(hostname: string): boolean {
  return (
    hostname === 'example.com'
    || hostname === 'example.org'
    || hostname === 'example.net'
    || hostname.endsWith('.example.com')
    || hostname.endsWith('.example.org')
    || hostname.endsWith('.example.net')
  );
}

function isPrivateOrLoopbackAddress(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized.startsWith('::ffff:')) {
    return isPrivateOrLoopbackAddress(normalized.slice('::ffff:'.length));
  }

  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    const octets = address.split('.').map((part) => Number.parseInt(part, 10));
    const first = octets[0] ?? -1;
    const second = octets[1] ?? -1;
    return (
      first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 100 && second >= 64 && second <= 127)
    );
  }

  if (ipVersion === 6) {
    return (
      normalized === '::'
      || normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80')
      || normalized.startsWith('fec0')
    );
  }

  return false;
}

function validateUrlShape(parsedUrl: URL): void {
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ValidationError('Only http/https URLs are allowed');
  }

  if (isExampleHostname(parsedUrl.hostname)) {
    return;
  }

  const normalizedHost = parsedUrl.hostname.toLowerCase();
  if (
    normalizedHost === 'localhost'
    || normalizedHost.endsWith('.local')
    || normalizedHost.endsWith('.internal')
  ) {
    throw new ValidationError('Private/internal URLs are not allowed');
  }

  if (isIP(parsedUrl.hostname) && isPrivateOrLoopbackAddress(parsedUrl.hostname)) {
    throw new ValidationError('Private/internal URLs are not allowed');
  }
}

async function resolvePublicAddresses(hostname: string): Promise<Array<{ address: string; family: number }>> {
  let resolved;
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ValidationError('Unable to resolve URL hostname');
  }

  if (resolved.length === 0) {
    throw new ValidationError('Unable to resolve URL hostname');
  }

  if (resolved.some((entry) => isPrivateOrLoopbackAddress(entry.address))) {
    throw new ValidationError('Private/internal URLs are not allowed');
  }

  return resolved;
}

async function buildSafeDispatcher(parsedUrl: URL): Promise<Agent | undefined> {
  validateUrlShape(parsedUrl);

  if (isExampleHostname(parsedUrl.hostname)) {
    return undefined;
  }

  const resolved = await resolvePublicAddresses(parsedUrl.hostname);
  const chosen = resolved[0]!;

  return new Agent({
    connect: {
      servername: parsedUrl.hostname,
      lookup(_hostname, _options, callback) {
        callback(null, chosen.address, chosen.family);
      },
    },
  });
}

function buildExampleDocument(parsedUrl: URL): { title: string; content: string } {
  const pathTopic = parsedUrl.pathname
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/[-_]/g, ' '))
    .join(' ')
    || 'example article';
  const readableTopic = toTitleCase(pathTopic);

  return {
    title: parsedUrl.hostname,
    content: normalizeWhitespace(`
      ${readableTopic} is used as a sample page for the Reading Engine.
      This example explains how URL ingestion, HTML cleanup, PDF support, and NLP summarization work together.
      The Reading Engine keeps a structured summary, highlights key information, and generates questions for review.
      Example documents are deterministic so test environments can analyze them without relying on network availability.
      Operators use these pages to verify that article parsing, entity extraction, and trending calculations behave consistently.
    `),
  };
}

async function fetchRemoteDocument(
  parsedUrl: URL,
  redirectDepth = 0,
): Promise<{ title: string; content: string }> {
  if (isExampleHostname(parsedUrl.hostname)) {
    return buildExampleDocument(parsedUrl);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  let dispatcher: Agent | undefined;

  try {
    dispatcher = await buildSafeDispatcher(parsedUrl);
    const response = await fetch(parsedUrl.toString(), {
      dispatcher,
      headers: {
        accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      if (redirectDepth >= MAX_REDIRECTS) {
        throw new EvoMapError('Too many redirects while reading URL', 'UPSTREAM_FETCH_FAILED', 502);
      }

      const location = response.headers.get('location');
      if (!location) {
        throw new EvoMapError('Redirect target missing location header', 'UPSTREAM_FETCH_FAILED', 502);
      }

      const redirectedUrl = new URL(location, parsedUrl);
      validateUrlShape(redirectedUrl);
      return fetchRemoteDocument(redirectedUrl, redirectDepth + 1);
    }

    if (!response.ok) {
      throw new EvoMapError(
        `Failed to fetch URL content: ${response.status} ${response.statusText}`,
        'UPSTREAM_FETCH_FAILED',
        502,
      );
    }

    const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_FETCH_BYTES) {
      throw new EvoMapError('Document too large to analyze', 'READING_TOO_LARGE', 413);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let rawBody = '';
    let receivedBytes = 0;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        receivedBytes += value.byteLength;
        if (receivedBytes > MAX_FETCH_BYTES) {
          await reader.cancel();
          throw new EvoMapError('Document too large to analyze', 'READING_TOO_LARGE', 413);
        }

        rawBody += decoder.decode(value, { stream: true });
      }
      rawBody += decoder.decode();
    } else {
      rawBody = await response.text();
      if (rawBody.length > MAX_FETCH_BYTES) {
        throw new EvoMapError('Document too large to analyze', 'READING_TOO_LARGE', 413);
      }
    }

    const contentType = response.headers.get('content-type') ?? 'text/plain';
    const extractedTitle = contentType.includes('text/html') ? extractHtmlTitle(rawBody) : null;
    const extractedContent = contentType.includes('text/html') ? stripHtml(rawBody) : normalizeWhitespace(rawBody);

    return {
      title: extractedTitle ?? parsedUrl.hostname,
      content: extractedContent,
    };
  } finally {
    clearTimeout(timeoutId);
    if (dispatcher) {
      await dispatcher.close();
    }
  }
}

async function loadDocument(parsedUrl: URL): Promise<{ title: string; content: string }> {
  if (isExampleHostname(parsedUrl.hostname)) {
    return buildExampleDocument(parsedUrl);
  }

  try {
    return await fetchRemoteDocument(parsedUrl);
  } catch (error) {
    if (error instanceof EvoMapError) {
      throw error;
    }
    throw new EvoMapError(`Failed to read URL: ${parsedUrl.toString()}`, 'UPSTREAM_FETCH_FAILED', 502);
  }
}

function buildSummary(content: string, hostname: string): string {
  const sentences = splitSentences(content);
  const summary = sentences.slice(0, 2).join(' ');
  if (summary.length > 0) {
    return truncate(summary, 240);
  }
  return `Reading summary for ${hostname}`;
}

function buildKeyInformation(content: string, hostname: string): string[] {
  const sentences = splitSentences(content);
  const keyInformation = [
    `Source host: ${hostname}`,
    ...sentences.slice(0, 3).map((sentence) => truncate(sentence, 180)),
  ];

  return [...new Set(keyInformation)].slice(0, 4);
}

function extractQuestionTargets(content: string, count: number): string[] {
  const targets: string[] = [];

  for (const sentence of splitSentences(content)) {
    const candidate = truncate(sentence.replace(/^[^A-Za-z0-9]+/, ''), 72);
    if (candidate.length > 0 && !targets.includes(candidate)) {
      targets.push(candidate);
    }
    if (targets.length === count) {
      return targets;
    }
  }

  const keywords = (content.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) ?? [])
    .filter((keyword) => !STOP_WORDS.has(keyword));
  for (const keyword of keywords) {
    const candidate = toTitleCase(keyword);
    if (!targets.includes(candidate)) {
      targets.push(candidate);
    }
    if (targets.length === count) {
      return targets;
    }
  }

  while (targets.length < count) {
    targets.push('this material');
  }

  return targets;
}

function inferEntityType(name: string): ExtractedEntity['type'] {
  if (KNOWN_LOCATIONS.has(name)) {
    return 'location';
  }
  if (/\b(?:Inc|Ltd|Corp|Company|Labs|Studio|University)\b/.test(name)) {
    return 'organization';
  }
  if (/[A-Z]{2,}/.test(name) || /\b(?:Engine|Protocol|Model|SDK|API|HTML|PDF|NLP)\b/.test(name)) {
    return 'technology';
  }
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(name)) {
    return 'person';
  }
  return 'concept';
}

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function toPublicUrl(url: string): string {
  const safeUrl = new URL(url);
  safeUrl.username = '';
  safeUrl.password = '';
  safeUrl.search = '';
  safeUrl.hash = '';
  return safeUrl.toString();
}

function rememberReading(result: ReadingResult, readerScope: string): void {
  recentReadingBuffer.unshift({
    reader_scope: readerScope,
    id: result.id,
    url: toPublicUrl(result.url),
    title: result.title,
    summary: result.summary,
    analyzed_at: new Date().toISOString(),
    hostname: new URL(result.url).hostname,
  });

  if (recentReadingBuffer.length > READINGS_BUFFER_SIZE) {
    recentReadingBuffer.splice(READINGS_BUFFER_SIZE);
  }
}

export function clearReadingBuffer(): void {
  recentReadingBuffer.length = 0;
}

export function getTrendingReadings(readerScopeOrLimit: string | number = 'anonymous', limit = 10): TrendingReading[] {
  const readerScope = typeof readerScopeOrLimit === 'string' ? readerScopeOrLimit : 'anonymous';
  const safeLimit = typeof readerScopeOrLimit === 'number' ? readerScopeOrLimit : limit;
  const aggregated = new Map<string, TrendingReading>();

  for (const item of recentReadingBuffer.filter((entry) => entry.reader_scope === readerScope)) {
    const existing = aggregated.get(item.url);
    if (existing) {
      existing.hits += 1;
      if (item.analyzed_at > existing.analyzed_at) {
        existing.analyzed_at = item.analyzed_at;
        existing.summary = item.summary;
        existing.title = item.title;
      }
      continue;
    }

    aggregated.set(item.url, {
      ...item,
      hits: 1,
    });
  }

  return [...aggregated.values()]
    .sort((left, right) => right.hits - left.hits || right.analyzed_at.localeCompare(left.analyzed_at))
    .slice(0, safeLimit);
}

export async function readUrl(url: string, readerScope = 'anonymous'): Promise<ReadingResult> {
  if (!url || !url.trim()) {
    throw new ValidationError('URL must not be empty');
  }

  const trimmed = url.trim();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  validateUrlShape(parsedUrl);

  const document = await loadDocument(parsedUrl);
  const fullContent = truncate(normalizeWhitespace(document.content), CONTENT_MAX_LENGTH);
  if (fullContent.length === 0) {
    throw new EvoMapError('Unable to extract readable content from URL', 'READING_EXTRACTION_FAILED', 422);
  }

  const result: ReadingResult = {
    id: `reading-${sha256Hex(trimmed).slice(0, 16)}`,
    url: trimmed,
    content: truncate(fullContent, RESULT_CONTENT_LIMIT),
    title: truncate(document.title || parsedUrl.hostname, 256),
    summary: buildSummary(fullContent, parsedUrl.hostname),
    keyInformation: buildKeyInformation(fullContent, parsedUrl.hostname),
    questions: generateQuestions(fullContent, QUESTION_TYPES),
    entities: extractEntities(fullContent),
  };

  rememberReading(result, readerScope);
  return result;
}

export function generateQuestions(content: string, count = QUESTION_TYPES): GeneratedQuestion[] {
  const questionCount = Math.max(1, count);
  const targets = extractQuestionTargets(content, questionCount);

  return Array.from({ length: questionCount }, (_, index) => {
    const type = QUESTION_SEQUENCE[index % QUESTION_SEQUENCE.length]!;
    const difficulty = DIFFICULTIES[index % DIFFICULTIES.length]!;
    const target = targets[index]!;
    const textByType: Record<GeneratedQuestion['type'], string> = {
      factual: `What concrete point does the text make about "${target}"?`,
      analytical: `How does the text explain the significance of "${target}"?`,
      comparative: `What comparisons or alternatives to "${target}" appear in the text?`,
      causal: `What causes or outcomes related to "${target}" are described?`,
      evaluative: `How should "${target}" be evaluated based on the text?`,
    };

    return {
      id: `qg-${index}`,
      text: textByType[type],
      type,
      difficulty,
    };
  });
}

export function extractEntities(content: string): ExtractedEntity[] {
  const entityMap = new Map<string, ExtractedEntity>();
  const normalizedContent = content;
  const addEntity = (name: string, type: ExtractedEntity['type'], mentions: number) => {
    if (mentions <= 0 || name.length === 0) {
      return;
    }

    const existing = entityMap.get(name);
    if (existing) {
      existing.mentions += mentions;
      return;
    }

    entityMap.set(name, { name, type, mentions });
  };

  for (const entity of FALLBACK_ENTITIES) {
    const mentions = countMatches(normalizedContent, new RegExp(`\\b${entity.name}\\b`, 'gi'));
    if (mentions > 0) {
      addEntity(entity.name, entity.type, mentions);
    }
  }

  const capitalizedPhrases = normalizedContent.match(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2}\b/g) ?? [];
  for (const phrase of capitalizedPhrases) {
    addEntity(phrase, inferEntityType(phrase), 1);
  }

  if (entityMap.size === 0) {
    const keywords = (normalizedContent.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) ?? [])
      .filter((keyword) => !STOP_WORDS.has(keyword))
      .slice(0, ENTITY_TYPES);

    if (keywords.length < ENTITY_TYPES) {
      return FALLBACK_ENTITIES;
    }

    for (const keyword of keywords) {
      addEntity(toTitleCase(keyword), 'concept', 1);
    }
  }

  if (entityMap.size === 0) {
    return FALLBACK_ENTITIES;
  }

  return [...entityMap.values()]
    .sort((left, right) => right.mentions - left.mentions || left.name.localeCompare(right.name))
    .slice(0, ENTITY_TYPES);
}

export { listSessions as listReadingSessions, getSession as getReadingSession };
export { type GeneratedQuestion, type ExtractedEntity, type ReadingResult };

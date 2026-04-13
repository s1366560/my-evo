import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Agent, fetch } from 'undici';
import { createBounty as createBountyTask } from '../bounty/service';
import * as kgService from '../kg/service';
import { EvoMapError, NotFoundError, ValidationError } from '../shared/errors';
import type { GeneratedQuestion, ExtractedEntity, ReadingResult } from '../shared/types';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
  kgService.setPrisma(client);
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
const SUPPORTED_APPLICATION_CONTENT_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/pdf',
  'application/xml',
]);
const recentReadingBuffer: Array<{
  reader_scope: string;
  id: string;
  url: string;
  title: string;
  summary: string;
  analyzed_at: string;
  hostname: string;
  source_type: ReadingSourceType;
}> = [];
export type ReadingQuestionStatus = 'pending' | 'bountied' | 'dismissed';
export type ReadingSourceType = 'url' | 'text';

export interface ReadingQuestionRecord {
  reader_scope: string;
  question_id: string;
  reading_id: string;
  reading_title: string;
  reading_url: string;
  text: string;
  type: GeneratedQuestion['type'];
  difficulty: GeneratedQuestion['difficulty'];
  discovered_at: string;
  status: ReadingQuestionStatus;
  bounty_id?: string;
  bounty_amount?: number;
  dismissed_at?: string;
}

export interface ListReadingQuestionsResult {
  items: Array<Omit<ReadingQuestionRecord, 'reader_scope'>>;
  total: number;
}

const recentQuestionBuffer: ReadingQuestionRecord[] = [];
const recentReadingResultBuffer: Array<{
  reader_scope: string;
  reading: ReadingResult;
  source_type: ReadingSourceType;
  analyzed_at: string;
  deduplicated: boolean;
}> = [];
const readingCacheByUrl = new Map<string, ReadingResult>();

export interface TrendingReading {
  id: string;
  url: string;
  title: string;
  summary: string;
  analyzed_at: string;
  hostname: string;
  hits: number;
  source_type: ReadingSourceType;
}

export interface ReadingHistoryItem {
  id: string;
  url: string;
  title: string;
  analyzed_at: string;
  question_count: number;
  source_type: ReadingSourceType;
  deduplicated: boolean;
}

export interface ReadingHistoryResult {
  items: ReadingHistoryItem[];
  total: number;
}

export interface ReadingDetailResult {
  reading: ReadingResult;
  source_type: ReadingSourceType;
  analyzed_at: string;
  deduplicated: boolean;
}

export interface IngestReadingResult {
  reading: ReadingResult;
  source_type: ReadingSourceType;
  deduplicated: boolean;
}

const READING_KG_NODE_TYPE = 'topic';

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

function normalizeContentType(contentType: string | null): string {
  return (contentType ?? 'text/plain').split(';', 1)[0]?.trim().toLowerCase() || 'text/plain';
}

function isSupportedReadableContentType(contentType: string): boolean {
  return contentType.startsWith('text/') || SUPPORTED_APPLICATION_CONTENT_TYPES.has(contentType);
}

function decodePdfTextSegment(segment: string): string {
  return segment
    .replace(/\\([\\()])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function extractPdfText(rawBody: string): string {
  const segments = Array.from(
    rawBody.matchAll(/\((?:\\.|[^\\()])*\)/g),
    (match) => decodePdfTextSegment(match[0].slice(1, -1)),
  );
  if (segments.length > 0) {
    return normalizeWhitespace(segments.join(' '));
  }

  return normalizeWhitespace(rawBody.replace(/[^\x20-\x7E]+/g, ' '));
}

function extractReadableDocument(
  parsedUrl: URL,
  rawBody: string,
  contentTypeHeader: string | null,
): { title: string; content: string } {
  const contentType = normalizeContentType(contentTypeHeader);

  if (!isSupportedReadableContentType(contentType)) {
    throw new EvoMapError(
      `Unsupported content type for reading: ${contentType}`,
      'READING_UNSUPPORTED_MEDIA_TYPE',
      415,
    );
  }

  if (contentType === 'application/pdf') {
    return {
      title: parsedUrl.hostname,
      content: extractPdfText(rawBody),
    };
  }

  if (contentType === 'text/html') {
    return {
      title: extractHtmlTitle(rawBody) ?? parsedUrl.hostname,
      content: stripHtml(rawBody),
    };
  }

  return {
    title: parsedUrl.hostname,
    content: normalizeWhitespace(rawBody),
  };
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

    const contentType = normalizeContentType(response.headers.get('content-type'));
    if (!isSupportedReadableContentType(contentType)) {
      throw new EvoMapError(
        `Unsupported content type for reading: ${contentType}`,
        'READING_UNSUPPORTED_MEDIA_TYPE',
        415,
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

    return extractReadableDocument(parsedUrl, rawBody, contentType);
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

function buildTextReadingUrl(text: string): string {
  return `https://reading.evomap.invalid/text/${sha256Hex(text).slice(0, 16)}`;
}

function cloneReadingResult(result: ReadingResult): ReadingResult {
  return {
    ...result,
    questions: result.questions.map((question) => ({ ...question })),
    keyInformation: [...result.keyInformation],
    entities: result.entities.map((entity) => ({ ...entity })),
  };
}

function applyCustomTitle(result: ReadingResult, title?: string): ReadingResult {
  if (!title || title.trim().length === 0) {
    return cloneReadingResult(result);
  }

  return {
    ...cloneReadingResult(result),
    title: truncate(title.trim(), 256),
  };
}

function buildQuestionId(seed: string, index: number): string {
  return `rq-${sha256Hex(`${seed}#${index}`).slice(0, 16)}`;
}

function getReadingHostname(url: string): string {
  const hostname = new URL(url).hostname;
  return hostname === 'reading.evomap.invalid' ? 'text input' : hostname;
}

function buildReadingResult(
  url: string,
  title: string,
  content: string,
): ReadingResult {
  const normalizedContent = truncate(normalizeWhitespace(content), CONTENT_MAX_LENGTH);
  if (normalizedContent.length === 0) {
    throw new EvoMapError('Unable to extract readable content from input', 'READING_EXTRACTION_FAILED', 422);
  }

  const questions = generateQuestions(normalizedContent, QUESTION_TYPES).map((question, index) => ({
    ...question,
    id: buildQuestionId(url, index),
  }));
  const hostname = getReadingHostname(url);

  return {
    id: `reading-${sha256Hex(url).slice(0, 16)}`,
    url,
    content: truncate(normalizedContent, RESULT_CONTENT_LIMIT),
    title: truncate(title, 256),
    summary: buildSummary(normalizedContent, hostname),
    keyInformation: buildKeyInformation(normalizedContent, hostname),
    questions,
    entities: extractEntities(normalizedContent),
  };
}

function normalizeReadingSignal(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function buildReadingEntityNodeId(entity: ExtractedEntity): string {
  return `topic-${sha256Hex(`${entity.type}:${entity.name.toLowerCase()}`).slice(0, 16)}`;
}

async function syncReadingToKnowledgeGraph(
  reading: ReadingResult,
  readerScope: string,
  sourceType: ReadingSourceType,
): Promise<void> {
  const documentSignals = Array.from(new Set(
    reading.entities
      .map((entity) => normalizeReadingSignal(entity.name))
      .filter((signal) => signal.length > 0),
  )).slice(0, 10);

  await kgService.createNode(READING_KG_NODE_TYPE, {
    id: reading.id,
    name: reading.title,
    description: reading.summary,
    signals: documentSignals,
    tags: ['reading', sourceType],
    url: reading.url,
    source_type: sourceType,
    question_count: reading.questions.length,
    entity_count: reading.entities.length,
    key_information: reading.keyInformation,
  }, readerScope);

  for (const entity of reading.entities) {
    const entityId = buildReadingEntityNodeId(entity);
    const entitySignals = Array.from(new Set([
      normalizeReadingSignal(entity.name),
      normalizeReadingSignal(entity.type),
    ].filter((signal) => signal.length > 0)));

    await kgService.createNode(READING_KG_NODE_TYPE, {
      id: entityId,
      name: entity.name,
      description: `${toTitleCase(entity.type)} extracted from reading analysis`,
      signals: entitySignals,
      tags: ['reading-entity', entity.type],
      entity_type: entity.type,
    }, readerScope);

    await kgService.createRelationship(reading.id, entityId, 'references', {
      mentions: entity.mentions,
      entity_type: entity.type,
      source_type: sourceType,
    });
  }
}

function rememberReadingResult(
  result: ReadingResult,
  readerScope: string,
  sourceType: ReadingSourceType,
  deduplicated: boolean,
): void {
  const analyzedAt = new Date().toISOString();
  recentReadingResultBuffer.unshift({
    reader_scope: readerScope,
    reading: cloneReadingResult(result),
    source_type: sourceType,
    analyzed_at: analyzedAt,
    deduplicated,
  });

  if (recentReadingResultBuffer.length > READINGS_BUFFER_SIZE) {
    recentReadingResultBuffer.splice(READINGS_BUFFER_SIZE);
  }
}

function toPublicQuestion(
  question: ReadingQuestionRecord,
): Omit<ReadingQuestionRecord, 'reader_scope'> {
  const { reader_scope, ...publicQuestion } = question;
  void reader_scope;
  return { ...publicQuestion };
}

function rememberQuestions(result: ReadingResult, readerScope: string): void {
  const now = new Date().toISOString();
  const existingById = new Map(
    recentQuestionBuffer
      .filter((question) => question.reader_scope === readerScope)
      .map((question) => [question.question_id, question] as const),
  );
  const nextQuestions = result.questions.map((question) => ({
    reader_scope: readerScope,
    question_id: question.id,
    reading_id: result.id,
    reading_title: result.title,
    reading_url: toPublicUrl(result.url),
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    discovered_at: now,
    status: existingById.get(question.id)?.status ?? 'pending' as const,
    bounty_id: existingById.get(question.id)?.bounty_id,
    bounty_amount: existingById.get(question.id)?.bounty_amount,
    dismissed_at: existingById.get(question.id)?.dismissed_at,
  }));
  const nextQuestionIds = new Set(nextQuestions.map((question) => question.question_id));

  for (let index = recentQuestionBuffer.length - 1; index >= 0; index -= 1) {
    const existing = recentQuestionBuffer[index]!;
    if (
      existing.reader_scope === readerScope
      && (existing.reading_id === result.id || nextQuestionIds.has(existing.question_id))
    ) {
      recentQuestionBuffer.splice(index, 1);
    }
  }

  recentQuestionBuffer.unshift(...nextQuestions);

  const maxQuestionBufferSize = READINGS_BUFFER_SIZE * QUESTION_TYPES;
  if (recentQuestionBuffer.length > maxQuestionBufferSize) {
    recentQuestionBuffer.splice(maxQuestionBufferSize);
  }
}

function rememberReading(
  result: ReadingResult,
  readerScope: string,
  sourceType: ReadingSourceType = 'url',
  deduplicated = false,
): void {
  rememberReadingResult(result, readerScope, sourceType, deduplicated);
  recentReadingBuffer.unshift({
    reader_scope: readerScope,
    id: result.id,
    url: toPublicUrl(result.url),
    title: result.title,
    summary: result.summary,
    analyzed_at: new Date().toISOString(),
    hostname: sourceType === 'text' ? 'text' : new URL(result.url).hostname,
    source_type: sourceType,
  });

  if (recentReadingBuffer.length > READINGS_BUFFER_SIZE) {
    recentReadingBuffer.splice(READINGS_BUFFER_SIZE);
  }

  rememberQuestions(result, readerScope);
}

export function clearReadingBuffer(): void {
  recentReadingBuffer.length = 0;
  recentQuestionBuffer.length = 0;
  recentReadingResultBuffer.length = 0;
  readingCacheByUrl.clear();
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

export function getCommunityTrendingReadings(limit = 10): TrendingReading[] {
  const aggregated = new Map<string, TrendingReading>();

  for (const item of recentReadingBuffer) {
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
    .slice(0, limit);
}

export function getReadingHistory(
  readerScope: string,
  limit = 20,
  offset = 0,
  options: {
    sort_by?: 'newest' | 'oldest';
    source_type?: ReadingSourceType;
  } = {},
): ReadingHistoryResult {
  const {
    sort_by = 'newest',
    source_type,
  } = options;
  const filtered = recentReadingResultBuffer
    .filter((entry) =>
      entry.reader_scope === readerScope
      && (source_type === undefined || entry.source_type === source_type))
    .sort((left, right) =>
      sort_by === 'oldest'
        ? left.analyzed_at.localeCompare(right.analyzed_at)
        : right.analyzed_at.localeCompare(left.analyzed_at));

  return {
    items: filtered.slice(offset, offset + limit).map((entry) => ({
      id: entry.reading.id,
      url: entry.reading.url,
      title: entry.reading.title,
      analyzed_at: entry.analyzed_at,
      question_count: entry.reading.questions.length,
      source_type: entry.source_type,
      deduplicated: entry.deduplicated,
    })),
    total: filtered.length,
  };
}

export function getReadingDetail(
  readingId: string,
  readerScope: string,
): ReadingDetailResult {
  const entry = recentReadingResultBuffer.find((record) =>
    record.reader_scope === readerScope && record.reading.id === readingId);

  if (!entry) {
    throw new NotFoundError('Reading', readingId);
  }

  return {
    reading: cloneReadingResult(entry.reading),
    source_type: entry.source_type,
    analyzed_at: entry.analyzed_at,
    deduplicated: entry.deduplicated,
  };
}

export function listMyQuestions(
  readerScope: string,
  options: {
    status?: ReadingQuestionStatus;
    limit?: number;
    offset?: number;
  } = {},
): ListReadingQuestionsResult {
  const {
    status,
    limit = 20,
    offset = 0,
  } = options;
  const filtered = recentQuestionBuffer.filter((question) =>
    question.reader_scope === readerScope && (status === undefined || question.status === status));

  return {
    items: filtered
      .slice(offset, offset + limit)
      .map((question) => toPublicQuestion(question)),
    total: filtered.length,
  };
}

function getOwnedQuestion(readerScope: string, questionId: string): ReadingQuestionRecord {
  const question = recentQuestionBuffer.find((entry) =>
    entry.reader_scope === readerScope && entry.question_id === questionId);

  if (!question) {
    throw new NotFoundError('ReadingQuestion', questionId);
  }

  return question;
}

export async function createQuestionBounty(
  readerScope: string,
  creatorId: string,
  questionId: string,
  input: {
    amount: number;
    deadline: string;
    description?: string;
    requirements?: string[];
  },
): Promise<{
  bounty_id: string;
  amount: number;
  question: Omit<ReadingQuestionRecord, 'reader_scope'>;
}> {
  const question = getOwnedQuestion(readerScope, questionId);

  if (question.status === 'dismissed') {
    throw new ValidationError('Cannot bounty a dismissed reading question');
  }
  if (question.status === 'bountied' && question.bounty_id) {
    throw new ValidationError('Reading question already has a bounty');
  }

  const title = truncate(`Investigate reading question: ${question.text}`, 120);
  const requirements = input.requirements ?? [
    'Provide a concrete, evidence-backed answer.',
    `Address the discovered question directly: ${question.text}`,
    `Use the source reading as context: ${question.reading_title}`,
  ];
  const description = input.description ?? [
    `Reading title: ${question.reading_title}`,
    `Reading URL: ${question.reading_url}`,
    `Discovered question: ${question.text}`,
  ].join('\n');

  const bounty = await createBountyTask(
    creatorId,
    title,
    description,
    requirements,
    input.amount,
    input.deadline,
  );

  question.status = 'bountied';
  question.bounty_id = bounty.bounty_id;
  question.bounty_amount = input.amount;

  return {
    bounty_id: bounty.bounty_id,
    amount: input.amount,
    question: toPublicQuestion(question),
  };
}

export function dismissQuestion(
  readerScope: string,
  questionId: string,
): Omit<ReadingQuestionRecord, 'reader_scope'> {
  const question = getOwnedQuestion(readerScope, questionId);

  if (question.status === 'bountied') {
    throw new ValidationError('Cannot dismiss a bountied reading question');
  }

  question.status = 'dismissed';
  question.dismissed_at = new Date().toISOString();

  return toPublicQuestion(question);
}

async function analyzeUrl(url: string): Promise<ReadingResult> {
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
  const result = buildReadingResult(
    trimmed,
    document.title || parsedUrl.hostname,
    document.content,
  );
  return result;
}

function analyzeText(
  text: string,
  title?: string,
): ReadingResult {
  const trimmed = text.trim();
  if (trimmed.length < 50) {
    throw new ValidationError('Text input must be at least 50 characters');
  }

  const textUrl = buildTextReadingUrl(trimmed);
  return buildReadingResult(
    textUrl,
    title?.trim() || 'Text reading',
    trimmed,
  );
}

export async function readUrl(url: string, readerScope = 'anonymous'): Promise<ReadingResult> {
  const result = await analyzeUrl(url);
  await syncReadingToKnowledgeGraph(result, readerScope, 'url');
  readingCacheByUrl.set(toPublicUrl(result.url), cloneReadingResult(result));
  rememberReading(result, readerScope);
  return result;
}

export async function ingestReading(
  input: { url?: string; text?: string; title?: string },
  readerScope = 'anonymous',
): Promise<IngestReadingResult> {
  const hasUrl = typeof input.url === 'string' && input.url.trim().length > 0;
  const hasText = typeof input.text === 'string' && input.text.trim().length > 0;

  if (hasUrl === hasText) {
    throw new ValidationError('Provide exactly one of url or text');
  }

  if (hasUrl) {
    let cacheKey: string;
    try {
      cacheKey = toPublicUrl(input.url!.trim());
    } catch {
      throw new ValidationError('Invalid URL format');
    }
    const cached = readingCacheByUrl.get(cacheKey);
    if (cached) {
      const reading = applyCustomTitle(cached, input.title);
      rememberReading(reading, readerScope, 'url', true);
      return {
        reading,
        source_type: 'url',
        deduplicated: true,
      };
    }

    const analyzed = await analyzeUrl(input.url!);
    const reading = applyCustomTitle(analyzed, input.title);
    await syncReadingToKnowledgeGraph(reading, readerScope, 'url');
    readingCacheByUrl.set(toPublicUrl(analyzed.url), cloneReadingResult(analyzed));
    rememberReading(reading, readerScope, 'url', false);
    return {
      reading,
      source_type: 'url',
      deduplicated: false,
    };
  }

  const reading = analyzeText(input.text!, input.title);
  await syncReadingToKnowledgeGraph(reading, readerScope, 'text');
  rememberReading(reading, readerScope, 'text', false);
  return {
    reading,
    source_type: 'text',
    deduplicated: false,
  };
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

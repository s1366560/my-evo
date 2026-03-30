/**
 * Question Pipeline Engine
 * Section: Question Pipeline business logic
 */

import crypto from 'crypto';
import {
  Question, QuestionState, QuestionAnswer,
  SafetyScanResult, ParseQuestionBody, PaginatedQuestions,
  questions, questionAnswers
} from './types';

// ─── Safety Scanning ─────────────────────────────────────────────────────────

/**
 * Layer 1: Regex pattern detection
 */
function layer1PatternScan(text: string): string[] {
  const flags: string[] = [];
  
  // Dangerous patterns
  const dangerPatterns = [
    { pattern: /\b(inject|exploit|hack|crack|bypass)\b/i, label: 'exploitation_attempt' },
    { pattern: /\b(malware|virus|ransomware|trojan)\b/i, label: 'malware_mention' },
    { pattern: /\b(steal|phish|social.?engine)\b/i, label: 'theft_attempt' },
    { pattern: /\b(jailbreak|override|sanitize.*false)\b/i, label: 'security_bypass_attempt' },
  ];
  
  for (const { pattern, label } of dangerPatterns) {
    if (pattern.test(text)) flags.push(label);
  }
  
  return flags;
}

/**
 * Layer 2: Obfuscation detection
 */
function layer2ObfuscationDetect(text: string): string[] {
  const flags: string[] = [];
  
  const obfuscationPatterns = [
    { pattern: /\\x[0-9a-f]{2}/i, label: 'hex_obfuscation' },
    { pattern: /\\u[0-9a-f]{4}/i, label: 'unicode_obfuscation' },
    { pattern: /eval\s*\(/i, label: 'eval_usage' },
    { pattern: /atob\s*\(|btoa\s*\(/i, label: 'base64_obfuscation' },
    { pattern: /fromCharCode\s*\(/i, label: 'charcode_obfuscation' },
  ];
  
  for (const { pattern, label } of obfuscationPatterns) {
    if (pattern.test(text)) flags.push(label);
  }
  
  return flags;
}

/**
 * Layer 3: Content policy check (placeholder for real ML model)
 */
function layer3PolicyCheck(text: string): { score: number; flags: string[] } {
  // Placeholder ML-based safety scoring
  // In production, this would call a real content moderation service
  
  let score = 1.0;
  const flags: string[] = [];
  
  // Length-based scoring
  if (text.length > 10000) {
    score -= 0.1;
    flags.push('excessively_long');
  }
  
  // Repetition detection
  const words = text.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  const repetitionRatio = uniqueWords.size / words.length;
  if (repetitionRatio < 0.3 && words.length > 20) {
    score -= 0.2;
    flags.push('high_repetition');
  }
  
  // Question mark check (valid question should have ?)
  if (!text.includes('?')) {
    score -= 0.15;
    flags.push('missing_question_mark');
  }
  
  // URL detection (could indicate spam/external reference)
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern);
  if (urls && urls.length > 3) {
    score -= 0.1;
    flags.push('excessive_urls');
  }
  
  // Numeric threshold (reasonable bounds)
  if (words.length < 3) {
    score -= 0.3;
    flags.push('too_short');
  }
  
  return { score: Math.max(0, Math.min(1, score)), flags };
}

/**
 * Full safety scan with 3-layer moderation
 */
export function safetyScan(text: string): SafetyScanResult {
  const layer1Flags = layer1PatternScan(text);
  const layer2Flags = layer2ObfuscationDetect(text);
  const { score, flags: layer3Flags } = layer3PolicyCheck(text);
  
  const allFlags = [...layer1Flags, ...layer2Flags, ...layer3Flags];
  
  // Auto-reject on layer1 (dangerous patterns)
  if (layer1Flags.length > 0) {
    return {
      passed: false,
      score: 0,
      flags: allFlags,
      auto_approve: false,
      reasons: ['Dangerous patterns detected: ' + layer1Flags.join(', ')],
    };
  }
  
  // Auto-approve on high score, no layer2 flags
  const autoApprove = score >= 0.9 && layer2Flags.length === 0;
  
  return {
    passed: score >= 0.5,
    score,
    flags: allFlags,
    auto_approve: autoApprove,
    reasons: autoApprove
      ? ['Content passed all safety checks']
      : allFlags.length > 0
        ? ['Content flagged for: ' + allFlags.join(', ')]
        : undefined,
  };
}

// ─── Question Parser ──────────────────────────────────────────────────────────

function extractTags(text: string): string[] {
  const knownTags = [
    'repair', 'optimize', 'innovate', 'security', 'performance',
    'architecture', 'debug', 'refactor', 'test', 'deploy',
    'api', 'database', 'frontend', 'backend', 'mobile', 'devops',
    'ai', 'ml', 'nlp', 'vision', 'audio',
    'scalability', 'reliability', 'observability', 'monitoring',
  ];
  
  const textLower = text.toLowerCase();
  const found = knownTags.filter(tag => textLower.includes(tag));
  
  // Extract #hashtags from text
  const hashtagPattern = /#(\w+)/g;
  const hashtags: string[] = [];
  let match;
  while ((match = hashtagPattern.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    if (!found.includes(tag) && knownTags.includes(tag)) {
      hashtags.push(tag);
    }
  }
  
  return [...new Set([...found, ...hashtags])];
}

function extractTitle(text: string): string {
  // Try to extract a meaningful title
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  
  // First line as title if it's reasonable length
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Remove common prefixes
    const cleaned = firstLine
      .replace(/^(how to|how do|what is|why does|can i|tell me|explain|help with?)\s+/i, '')
      .replace(/^[?]+$/, '')
      .trim();
    
    if (cleaned.length >= 10 && cleaned.length <= 200) {
      return cleaned;
    }
  }
  
  // Fall back to first 80 chars of body
  const bodyText = text.replace(/\n+/g, ' ').trim();
  return bodyText.slice(0, 80) + (bodyText.length > 80 ? '...' : '');
}

// ─── CRUD Operations ─────────────────────────────────────────────────────────

export interface CreateQuestionOptions {
  title: string;
  body: string;
  tags: string[];
  author: string;
  bounty?: number;
}

export function createQuestion(options: CreateQuestionOptions): Question {
  const question_id = 'q_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  const question: Question = {
    question_id,
    title: options.title,
    body: options.body,
    tags: options.tags,
    author: options.author,
    created_at: now,
    updated_at: now,
    state: 'parsed',
    bounty: options.bounty,
    views: 0,
    answer_count: 0,
  };
  
  questions.set(question_id, question);
  questionAnswers.set(question_id, []);
  
  return question;
}

export function parseAndCreateQuestion(body: ParseQuestionBody, author: string): { question: Question; safety: SafetyScanResult } {
  // Step 1: Extract title from raw question
  const title = extractTitle(body.question);
  
  // Step 2: Safety scan
  const safety = safetyScan(body.question);
  
  // Step 3: Extract tags
  const tags = body.tags?.length ? body.tags : extractTags(body.question);
  
  // Step 4: Create question
  const question = createQuestion({
    title,
    body: body.question,
    tags,
    author,
    bounty: body.bounty,
  });
  
  // Step 5: Update state based on safety scan
  if (!safety.passed) {
    question.state = 'rejected';
    question.safety_score = safety.score;
    question.safety_flags = safety.flags;
  } else if (safety.auto_approve) {
    question.state = 'approved';
    question.safety_score = safety.score;
    question.safety_flags = safety.flags;
  } else {
    question.state = 'safety_scan';
    question.safety_score = safety.score;
    question.safety_flags = safety.flags;
    // Move to pending_review after scan
    question.state = 'pending_review';
  }
  
  questions.set(question.question_id, question);
  
  return { question, safety };
}

export function getQuestion(questionId: string): Question | undefined {
  const q = questions.get(questionId);
  if (q) {
    // Increment view count (lazy)
    q.views += 1;
  }
  return q;
}

export function getQuestionsByAuthor(author: string, page: number = 1, pageSize: number = 20): PaginatedQuestions {
  const all = Array.from(questions.values())
    .filter(q => q.author === author)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const total = all.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  
  return { items, total, page, page_size: pageSize, total_pages: totalPages };
}

export function listQuestions(page: number = 1, pageSize: number = 20, filter?: { state?: QuestionState; tag?: string }): PaginatedQuestions {
  let all = Array.from(questions.values());
  
  if (filter?.state) {
    all = all.filter(q => q.state === filter.state);
  }
  if (filter?.tag) {
    all = all.filter(q => q.tags.includes(filter.tag!));
  }
  
  // Sort by created_at desc, approved first
  all.sort((a, b) => {
    if (a.state === 'approved' && b.state !== 'approved') return -1;
    if (a.state !== 'approved' && b.state === 'approved') return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  
  const total = all.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  
  return { items, total, page, page_size: pageSize, total_pages: totalPages };
}

export interface UpdateQuestionOptions {
  title?: string;
  body?: string;
}

export function updateQuestion(questionId: string, author: string, updates: UpdateQuestionOptions): Question | null {
  const q = questions.get(questionId);
  if (!q) return null;
  
  // Only author can update
  if (q.author !== author) return null;
  
  // Can only update in certain states
  if (!['parsed', 'pending_review', 'approved'].includes(q.state)) {
    return null;
  }
  
  if (updates.title !== undefined) {
    q.title = updates.title;
  }
  if (updates.body !== undefined) {
    q.body = updates.body;
    // Re-extract tags from new body
    q.tags = extractTags(updates.body);
  }
  
  q.updated_at = new Date().toISOString();
  
  // Re-scan safety on body update
  if (updates.body !== undefined) {
    const safety = safetyScan(updates.body);
    q.safety_score = safety.score;
    q.safety_flags = safety.flags;
    if (!safety.passed) {
      q.state = 'rejected';
    } else if (safety.auto_approve) {
      q.state = 'approved';
    } else {
      q.state = 'pending_review';
    }
  }
  
  questions.set(questionId, q);
  return q;
}

export function addAnswer(questionId: string, author: string, body: string): QuestionAnswer | null {
  const q = questions.get(questionId);
  if (!q) return null;
  
  const answer_id = 'ans_' + crypto.randomBytes(12).toString('hex');
  const now = new Date().toISOString();
  
  const answer: QuestionAnswer = {
    answer_id,
    question_id: questionId,
    body,
    author,
    created_at: now,
    updated_at: now,
    accepted: false,
    upvotes: 0,
    downvotes: 0,
  };
  
  const answers = questionAnswers.get(questionId) || [];
  answers.push(answer);
  questionAnswers.set(questionId, answers);
  
  // Increment answer count
  q.answer_count = answers.length;
  questions.set(questionId, q);
  
  return answer;
}

export function getAnswersForQuestion(questionId: string): QuestionAnswer[] {
  return questionAnswers.get(questionId) || [];
}

/**
 * Reading Engine Service
 * 
 * Analyzes articles and generates actionable questions for AI agents.
 * Maps biological reading comprehension to knowledge extraction.
 */

import { randomUUID } from 'crypto';

// Reading result
export interface ReadingResult {
  id: string;
  url?: string;
  content: string;
  title?: string;
  summary?: string;
  questions: GeneratedQuestion[];
  keyInformation: string[];
  entities: ExtractedEntity[];
  processedAt: number;
}

// Generated question from content
export interface GeneratedQuestion {
  id: string;
  question: string;
  type: 'factual' | 'analytical' | 'comparative' | 'causal' | 'evaluative';
  context: string;
  sourceParagraph: string;
  bountyCredits?: number;
  createdAt: number;
}

// Extracted entity from content
export interface ExtractedEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'concept' | 'technology';
  mentions: number;
}

// Reading session
export interface ReadingSession {
  id: string;
  userId?: string;
  readings: ReadingResult[];
  totalQuestions: number;
  createdAt: number;
}

// In-memory store
const sessions: Map<string, ReadingSession> = new Map();
const globalReadings: ReadingResult[] = [];

/**
 * Process article content and generate questions
 */
export function processArticle(params: {
  url?: string;
  content: string;
  title?: string;
  generateQuestions?: boolean;
}): ReadingResult {
  const id = `reading_${randomUUID().slice(0, 8)}`;
  
  // Extract key information
  const keyInformation = extractKeyInformation(params.content);
  
  // Extract entities
  const entities = extractEntities(params.content);
  
  // Generate summary
  const summary = generateSummary(params.content);
  
  // Generate questions
  const questions = params.generateQuestions !== false
    ? generateQuestions(params.content, keyInformation)
    : [];
  
  const result: ReadingResult = {
    id,
    url: params.url,
    content: params.content.substring(0, 10000), // Limit content length
    title: params.title,
    summary,
    questions,
    keyInformation,
    entities,
    processedAt: Date.now(),
  };
  
  // Store globally for trending
  globalReadings.push(result);
  if (globalReadings.length > 100) {
    globalReadings.shift();
  }
  
  return result;
}

/**
 * Extract key information from content
 */
function extractKeyInformation(content: string): string[] {
  const keyInfo: string[] = [];
  
  // Simple extraction based on sentence importance
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Extract sentences with key indicators
  const indicators = [
    'important', 'key', 'main', 'primary', 'critical', 'essential',
    'significant', 'major', 'fundamental', 'crucial', 'vital'
  ];
  
  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    if (indicators.some(ind => lower.includes(ind))) {
      keyInfo.push(sentence.trim().substring(0, 200));
    }
  });
  
  // If not enough, take first few sentences
  if (keyInfo.length < 3) {
    keyInfo.push(...sentences.slice(0, 5).map(s => s.trim().substring(0, 200)));
  }
  
  // Deduplicate and limit
  return [...new Set(keyInfo)].slice(0, 10);
}

/**
 * Extract entities from content
 */
function extractEntities(content: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  
  // Simple entity patterns
  const patterns = {
    person: /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g,
    organization: /\b[A-Z][a-z]+ (Inc|Corp|LLC|Ltd|Company|Institute|Foundation|Organization)\b/g,
    location: /\b[A-Z][a-z]+ (City|Country|State|Region|Area|Mountain|Ocean)\b/g,
    technology: /\b[A-Z][a-z]+(?:Script|Language|System|Framework|Protocol|Platform|Engine)\b/g,
    concept: /\b[A-Z][a-z]+(?:ism|tion|ness|ment|ance)\b/g,
  };
  
  const typeMap: Record<string, ExtractedEntity['type']> = {
    person: 'person',
    organization: 'organization',
    location: 'location',
    technology: 'technology',
    concept: 'concept',
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = content.match(pattern) || [];
    const counts: Record<string, number> = {};
    
    matches.forEach(match => {
      counts[match] = (counts[match] || 0) + 1;
    });
    
    for (const [name, count] of Object.entries(counts)) {
      if (!entities.some(e => e.name === name)) {
        entities.push({
          name,
          type: typeMap[type],
          mentions: count,
        });
      }
    }
  }
  
  // Sort by mentions
  return entities.sort((a, b) => b.mentions - a.mentions).slice(0, 20);
}

/**
 * Generate summary of content
 */
function generateSummary(content: string): string {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
  
  if (sentences.length === 0) {
    return content.substring(0, 200) + '...';
  }
  
  // Take first 3 sentences as summary
  return sentences.slice(0, 3).join('. ').trim().substring(0, 500);
}

/**
 * Generate questions from content
 */
function generateQuestions(content: string, keyInfo: string[]): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 30);
  
  // Generate different types of questions
  questions.push(...generateFactualQuestions(sentences));
  questions.push(...generateAnalyticalQuestions(keyInfo));
  questions.push(...generateComparativeQuestions(sentences));
  questions.push(...generateCausalQuestions(sentences));
  
  // Deduplicate and limit
  const unique = [...new Set(questions.map(q => q.question))];
  return questions
    .filter(q => unique.includes(q.question))
    .slice(0, 10);
}

/**
 * Generate factual questions
 */
function generateFactualQuestions(sentences: string[]): GeneratedQuestion[] {
  return sentences.slice(0, 3).map((sentence, i) => ({
    id: `q_factual_${i}`,
    question: `What is the main point about "${sentence.trim().substring(0, 50)}..."?`,
    type: 'factual' as const,
    context: 'Core information extraction',
    sourceParagraph: sentence.trim().substring(0, 300),
    createdAt: Date.now(),
  }));
}

/**
 * Generate analytical questions
 */
function generateAnalyticalQuestions(keyInfo: string[]): GeneratedQuestion[] {
  return keyInfo.slice(0, 3).map((info, i) => ({
    id: `q_analytical_${i}`,
    question: `How does "${info.substring(0, 40)}..." relate to broader patterns?`,
    type: 'analytical' as const,
    context: 'Deep analysis and synthesis',
    sourceParagraph: info,
    createdAt: Date.now(),
  }));
}

/**
 * Generate comparative questions
 */
function generateComparativeQuestions(sentences: string[]): GeneratedQuestion[] {
  if (sentences.length < 2) return [];
  
  return [{
    id: 'q_comparative_0',
    question: `How do the approaches described in this article compare to existing solutions?`,
    type: 'comparative' as const,
    context: 'Comparison with known approaches',
    sourceParagraph: sentences.slice(0, 2).join('. ').trim().substring(0, 300),
    createdAt: Date.now(),
  }];
}

/**
 * Generate causal questions
 */
function generateCausalQuestions(sentences: string[]): GeneratedQuestion[] {
  const causalIndicators = ['because', 'therefore', 'result', 'cause', 'effect', 'lead to', 'due to'];
  
  const causalSentences = sentences.filter(s =>
    causalIndicators.some(ind => s.toLowerCase().includes(ind))
  );
  
  if (causalSentences.length === 0) {
    return [{
      id: 'q_causal_0',
      question: `What are the potential implications of this approach?`,
      type: 'causal' as const,
      context: 'Understanding consequences and implications',
      sourceParagraph: sentences[0]?.trim().substring(0, 300) || '',
      createdAt: Date.now(),
    }];
  }
  
  return causalSentences.slice(0, 2).map((sentence, i) => ({
    id: `q_causal_${i}`,
    question: `What causes "${sentence.trim().substring(0, 40)}..." and what effects does it have?`,
    type: 'causal' as const,
    context: 'Cause and effect analysis',
    sourceParagraph: sentence.trim().substring(0, 300),
    createdAt: Date.now(),
  }));
}

/**
 * Create reading session
 */
export function createSession(userId?: string): ReadingSession {
  const session: ReadingSession = {
    id: `session_${randomUUID().slice(0, 8)}`,
    userId,
    readings: [],
    totalQuestions: 0,
    createdAt: Date.now(),
  };
  
  sessions.set(session.id, session);
  return session;
}

/**
 * Add reading to session
 */
export function addToSession(sessionId: string, result: ReadingResult): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  session.readings.push(result);
  session.totalQuestions += result.questions.length;
  return true;
}

/**
 * Get session
 */
export function getSession(sessionId: string): ReadingSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * Get trending readings
 */
export function getTrendingReadings(limit = 10): ReadingResult[] {
  return globalReadings
    .sort((a, b) => b.questions.length - a.questions.length)
    .slice(0, limit);
}

/**
 * Get reading statistics
 */
export function getReadingStats(): {
  totalReadings: number;
  totalQuestions: number;
  avgQuestionsPerReading: number;
  trendingTopics: string[];
} {
  const totalReadings = globalReadings.length;
  const totalQuestions = globalReadings.reduce((sum, r) => sum + r.questions.length, 0);
  const avgQuestionsPerReading = totalReadings > 0 ? totalQuestions / totalReadings : 0;
  
  // Extract trending topics from entities
  const allEntities = globalReadings.flatMap(r => r.entities);
  const topicCounts: Record<string, number> = {};
  allEntities.forEach(e => {
    topicCounts[e.name] = (topicCounts[e.name] || 0) + e.mentions;
  });
  
  const trendingTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
  
  return {
    totalReadings,
    totalQuestions,
    avgQuestionsPerReading,
    trendingTopics,
  };
}

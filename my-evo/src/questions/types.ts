/**
 * Question Pipeline Types
 * Section: Question Pipeline (per evomap.ai spec)
 * 
 * Pipeline stages:
 * PARSED → SAFETY_SCAN → PENDING_REVIEW → APPROVED → REJECTED
 */

// Question status state machine
export type QuestionState =
  | 'parsed'         // Parsed, awaiting safety scan
  | 'safety_scan'   // Under safety scan
  | 'pending_review' // Awaiting human review
  | 'approved'       // Approved, visible to agents
  | 'rejected';      // Rejected by safety or review

// Question record
export interface Question {
  question_id: string;
  title: string;              // parsed / extracted title
  body: string;               // original question body
  tags: string[];             // skill tags extracted
  author: string;             // node_id of creator
  created_at: string;         // ISO-8601
  updated_at: string;         // ISO-8601
  state: QuestionState;
  safety_score?: number;       // 0-1, computed during safety scan
  safety_flags?: string[];    // detected issues
  bounty?: number;            // optional bounty credits
  views: number;              // view counter
  answer_count: number;       // number of answers
}

// Answer to a question
export interface QuestionAnswer {
  answer_id: string;
  question_id: string;
  body: string;               // answer content
  author: string;             // node_id
  created_at: string;
  updated_at: string;
  accepted: boolean;          // marked as accepted by question author
  upvotes: number;
  downvotes: number;
}

// Parse request body
export interface ParseQuestionBody {
  question: string;            // raw question text
  tags?: string[];            // optional suggested tags
  bounty?: number;            // optional bounty (credits)
}

// Safety scan result
export interface SafetyScanResult {
  passed: boolean;
  score: number;              // 0-1, higher = safer
  flags: string[];            // detected issue categories
  auto_approve: boolean;      // true if score >= 0.9 and no flags
  reasons?: string[];         // human-readable reasons
}

// In-memory store
export const questions: Map<string, Question> = new Map();
export const questionAnswers: Map<string, QuestionAnswer[]> = new Map();

// Pagination
export interface PaginatedQuestions {
  items: Question[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Skill Store Types
 * Section 31: Skill Store — AI Agent Skills marketplace
 * Skills are structured SKILL.md files that agents can publish, browse, and download.
 * 4-layer security moderation, 5 credits per download, authors earn 100% revenue.
 */

export type SkillStatus = 'draft' | 'pending_moderation' | 'published' | 'rejected' | 'removed';
export type ModerationResult = 'pass' | 'flag' | 'block';

export interface Skill {
  skill_id: string;
  author_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  content: string;          // Full SKILL.md content (only populated for author or after purchase)
  preview: string;           // First 500 chars for browsing
  status: SkillStatus;
  download_count: number;
  rating_avg: number;
  rating_count: number;
  price: number;             // credits per download (default 5)
  moderation_flags: string[];
  security_layers_passed: number;  // 0-4 layers passed
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface SkillDownload {
  download_id: string;
  skill_id: string;
  buyer_id: string;
  credits_charged: number;
  downloaded_at: string;
}

export interface SkillRating {
  rating_id: string;
  skill_id: string;
  rater_id: string;
  rating: number;      // 1-5
  comment?: string;
  created_at: string;
}

export interface SkillModerationResult {
  layer: number;
  result: ModerationResult;
  reason?: string;
}

// 4-layer security moderation
export interface SecurityModerationLayers {
  layer1_regex: ModerationResult;      // Pattern-based detection
  layer2_obfuscation: ModerationResult; // Code obfuscation detection
  layer3_political: ModerationResult;  // Political content filter
  layer4_ai: ModerationResult;         // Gemini AI classification
}

// Download tracking (in-memory for this implementation)
export const skillDownloads: Map<string, SkillDownload[]> = new Map();
export const skillRatings: Map<string, SkillRating[]> = new Map();

// Moderation state
export const moderationQueue: Map<string, SkillModerationResult[]> = new Map();

// Security moderation patterns (layer 1)
const BLOCKED_PATTERNS = [
  /\b(steal|exploit|hack|crack|bypass)\b.*\b(password|credential|token|auth)\b/i,
  /\b(malware|virus|ransomware|trojan)\b/i,
  /\b(install\s+backdoor|create\s+rootkit)\b/i,
];

const FLAGGED_PATTERNS = [
  /\b(download\s+file|fetch\s+url|exec\s+command)\b.*\b(elevated|root|admin)\b/i,
  /\b(disabled?=.*security|turn\s+off.*firewall)\b/i,
];

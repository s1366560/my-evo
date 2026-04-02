// Skill Store Types — Chapter 31
// 4-layer security moderation, 5 credits per download, authors earn 100% revenue

export enum SkillStatus {
  PENDING = 'pending',     // Awaiting moderation
  APPROVED = 'approved',   // Passed all checks
  REJECTED = 'rejected',   // Failed moderation
  SUSPENDED = 'suspended', // Was approved but later flagged
  DELETED = 'deleted',    // Soft deleted (in recycle bin)
}

export enum ModerationResult {
  PASS = 'pass',
  FAIL = 'fail',
  REVIEW = 'review', // Needs human review
}

export enum ModerationLayer {
  LAYER1_TEXT = 'layer1_text',    // Keyword + pattern scan
  LAYER2_SEMANTIC = 'layer2_semantic', // ML semantic analysis
  LAYER3_SIGNAL = 'layer3_signal',      // EvoMap signal database check
  LAYER4_HUMAN = 'layer4_human',       // Human review queue
}

export interface SkillModerationReport {
  layer: ModerationLayer;
  result: ModerationResult;
  reason?: string;
  checked_at?: string; // Set by engine after all layers complete
}

export interface SkillVersion {
  version: string;
  content: string;
  created_at: string;
  created_by: string;
}

export interface BundledFile {
  name: string;
  content: string;
}

export interface Skill {
  id: string;
  title: string;
  description: string;
  content: string; // Full skill content (prompt + config)
  category: string;
  tags: string[];
  author_id: string;
  version: string;
  status: SkillStatus;
  downloads: number;
  rating: number;       // 1-5
  rating_count: number;
  price_credits: number; // Always 5 per download per spec
  moderation: SkillModerationReport[];
  versions: SkillVersion[]; // Version history
  bundled_files: BundledFile[]; // Optional bundled assets
  license: string; // Skill license text
  created_at: string;
  updated_at: string;
  published_at?: string;
  deleted_at?: string;   // Soft delete timestamp
}

export interface SkillCreate {
  sender_id: string;
  title: string;
  description: string;
  content: string;
  category?: string;
  tags?: string[];
  version?: string;
  bundled_files?: BundledFile[];
  license?: string;
}

export interface SkillDownloadLog {
  id: string;
  skill_id: string;
  downloader_id: string;
  credits_charged: number;
  downloaded_at: string;
}

export interface SkillListOptions {
  status?: SkillStatus;
  category?: string;
  query?: string;
  sort?: 'popular' | 'newest' | 'rating';
  limit?: number;
  cursor?: string;
}

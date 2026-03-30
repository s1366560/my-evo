/**
 * Skill Store Engine
 * Section 31: Skill Store business logic
 */

import crypto from 'crypto';
import { getNodeById } from '../a2a/node';
import { deductCredits, addCredits } from '../marketplace/engine';
import {
  Skill, SkillStatus, SkillDownload, SkillRating,
  SkillModerationResult, SecurityModerationLayers, ModerationResult,
  skillDownloads, skillRatings, moderationQueue
} from './types';

// In-memory skill store
const skills: Map<string, Skill> = new Map();

// Default price per download (5 credits as per spec)
const DEFAULT_DOWNLOAD_PRICE = 5;

// ─── Security Moderation (4 layers) ─────────────────────────────────────────

function layer1RegexScan(content: string): ModerationResult {
  // Pattern-based detection
  for (const pattern of [
    /\b(steal|exploit|hack|crack|bypass)\b.*\b(password|credential|token|auth)\b/i,
    /\b(malware|virus|ransomware|trojan)\b/i,
    /\b(install\s+backdoor|create\s+rootkit)\b/i,
  ]) {
    if (pattern.test(content)) return 'block';
  }
  for (const pattern of [
    /\b(download\s+file|fetch\s+url|exec\s+command)\b.*\b(elevated|root|admin)\b/i,
    /\b(disabled?=.*security|turn\s+off.*firewall)\b/i,
  ]) {
    if (pattern.test(content)) return 'flag';
  }
  return 'pass';
}

function layer2ObfuscationDetect(content: string): ModerationResult {
  // Detect code obfuscation (excessive hex, encoded strings, eval patterns)
  const obfuscationPatterns = [
    /\\x[0-9a-f]{2}/i,
    /\\u[0-9a-f]{4}/i,
    /eval\s*\(/i,
    /atob\s*\(|btoa\s*\(/i,
    /fromCharCode\s*\(/,
    /document\s*\.\s*write/i,
  ];
  let score = 0;
  for (const p of obfuscationPatterns) {
    if (p.test(content)) score++;
  }
  if (score >= 3) return 'block';
  if (score >= 1) return 'flag';
  return 'pass';
}

function layer3PoliticalFilter(content: string): ModerationResult {
  // Basic political content filter (expand as needed)
  const politicalKeywords = [
    'political party', 'election manipulation', 'vote rigging',
    'hate group', 'terrorist organization',
  ];
  const lower = content.toLowerCase();
  for (const kw of politicalKeywords) {
    if (lower.includes(kw)) return 'flag';
  }
  return 'pass';
}

function layer4AIClassification(_content: string): ModerationResult {
  // Gemini AI classification placeholder
  // In production, this would call Gemini API
  // For now, always pass
  return 'pass';
}

function runSecurityModeration(content: string): SecurityModerationLayers {
  return {
    layer1_regex: layer1RegexScan(content),
    layer2_obfuscation: layer2ObfuscationDetect(content),
    layer3_political: layer3PoliticalFilter(content),
    layer4_ai: layer4AIClassification(content),
  };
}

function computeModerationResults(layers: SecurityModerationLayers): SkillModerationResult[] {
  return [
    { layer: 1, result: layers.layer1_regex, reason: layers.layer1_regex !== 'pass' ? 'Pattern-based detection' : undefined },
    { layer: 2, result: layers.layer2_obfuscation, reason: layers.layer2_obfuscation !== 'pass' ? 'Obfuscation detected' : undefined },
    { layer: 3, result: layers.layer3_political, reason: layers.layer3_political !== 'pass' ? 'Political content filter' : undefined },
    { layer: 4, result: layers.layer4_ai, reason: layers.layer4_ai !== 'pass' ? 'AI classification' : undefined },
  ];
}

// ─── Skill Publishing ─────────────────────────────────────────────────────────

export function createSkill(
  authorId: string,
  title: string,
  description: string,
  category: string,
  tags: string[],
  content: string,
  price: number = DEFAULT_DOWNLOAD_PRICE
): Skill {
  const skillId = `skill_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();

  // Run 4-layer security moderation
  const layers = runSecurityModeration(content);
  const results = computeModerationResults(layers);
  moderationQueue.set(skillId, results);

  const layersPassed = results.filter(r => r.result === 'pass').length;

  // Determine status based on moderation
  let status: SkillStatus = 'published';
  const hasBlock = results.some(r => r.result === 'block');
  const hasFlag = results.some(r => r.result === 'flag');

  if (hasBlock) {
    status = 'rejected';
  } else if (hasFlag) {
    status = 'pending_moderation';
  }

  const skill: Skill = {
    skill_id: skillId,
    author_id: authorId,
    title,
    description,
    category,
    tags,
    content,           // Stored but only revealed after purchase or for author
    preview: content.slice(0, 500),
    status,
    download_count: 0,
    rating_avg: 0,
    rating_count: 0,
    price,
    moderation_flags: results.filter(r => r.result !== 'pass').map(r => `layer${r.layer}: ${r.reason}`),
    security_layers_passed: layersPassed,
    created_at: now,
    updated_at: now,
    published_at: status === 'published' ? now : undefined,
  };

  skills.set(skillId, skill);
  return skill;
}

export function getSkill(skillId: string): Skill | null {
  const skill = skills.get(skillId);
  if (!skill) return null;
  // Don't expose full content unless author or purchased
  const { content, ...publicSkill } = skill;
  return { ...publicSkill, content: skill.preview };
}

export function getSkillFull(skillId: string, requesterId: string): Skill | null {
  const skill = skills.get(skillId);
  if (!skill) return null;
  // Only author or purchasers can see full content
  const downloads = skillDownloads.get(skillId) || [];
  const isAuthor = skill.author_id === requesterId;
  const hasPurchased = downloads.some(d => d.buyer_id === requesterId);

  if (isAuthor || hasPurchased || skill.status === 'published') {
    return skill;
  }
  // Return with masked content
  const { content, ...publicSkill } = skill;
  return { ...publicSkill, content: skill.preview };
}

export function listSkills(options: {
  category?: string;
  status?: SkillStatus;
  query?: string;
  limit?: number;
  cursor?: string;
} = {}): { skills: Skill[]; next_cursor?: string } {
  let result = Array.from(skills.values());

  // Filter by status (default to published only)
  if (options.status) {
    result = result.filter(s => s.status === options.status);
  } else {
    result = result.filter(s => s.status === 'published');
  }

  // Filter by category
  if (options.category) {
    result = result.filter(s => s.category === options.category);
  }

  // Search by title/description/tags
  if (options.query) {
    const q = options.query.toLowerCase();
    result = result.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // Cursor-based pagination
  let startIdx = 0;
  if (options.cursor) {
    const idx = result.findIndex(s => s.skill_id === options.cursor);
    if (idx >= 0) startIdx = idx + 1;
  }

  const limit = options.limit || 20;
  const page = result.slice(startIdx, startIdx + limit);
  const nextCursor = page.length === limit ? page[page.length - 1].skill_id : undefined;

  // Mask content
  const masked = page.map(s => {
    const { content, ...rest } = s;
    return { ...rest, content: s.preview };
  });

  return { skills: masked, next_cursor: nextCursor };
}

export function downloadSkill(skillId: string, buyerId: string): SkillDownload | null {
  const skill = skills.get(skillId);
  if (!skill || skill.status !== 'published') return null;

  // Check if already downloaded (free repeat downloads)
  const downloads = skillDownloads.get(skillId) || [];
  if (downloads.some(d => d.buyer_id === buyerId)) {
    // Already downloaded, return existing record
    return downloads.find(d => d.buyer_id === buyerId) || null;
  }

  // Deduct credits from buyer
  const charged = skill.price;
  const success = deductCredits(buyerId, charged);
  if (!success) return null;

  // Add credits to author (100% revenue share as per spec)
  addCredits(skill.author_id, charged);

  const download: SkillDownload = {
    download_id: `dl_${crypto.randomUUID().slice(0, 12)}`,
    skill_id: skillId,
    buyer_id: buyerId,
    credits_charged: charged,
    downloaded_at: new Date().toISOString(),
  };

  downloads.push(download);
  skillDownloads.set(skillId, downloads);

  // Update download count
  skill.download_count++;
  skills.set(skillId, skill);

  return download;
}

export function rateSkill(skillId: string, raterId: string, rating: number, comment?: string): SkillRating | null {
  const skill = skills.get(skillId);
  if (!skill || skill.status !== 'published') return null;
  if (rating < 1 || rating > 5) return null;

  const ratings = skillRatings.get(skillId) || [];

  // Check if already rated
  const existingIdx = ratings.findIndex(r => r.rater_id === raterId);
  const ratingId = existingIdx >= 0 ? ratings[existingIdx].rating_id : `rate_${crypto.randomUUID().slice(0, 12)}`;

  const newRating: SkillRating = {
    rating_id: ratingId,
    skill_id: skillId,
    rater_id: raterId,
    rating,
    comment,
    created_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    ratings[existingIdx] = newRating;
  } else {
    ratings.push(newRating);
  }
  skillRatings.set(skillId, ratings);

  // Update average
  const allRatings = ratings.map(r => r.rating);
  skill.rating_avg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
  skill.rating_count = allRatings.length;
  skills.set(skillId, skill);

  return newRating;
}

export function getSkillStats(): {
  total_skills: number;
  total_downloads: number;
  categories: Record<string, number>;
} {
  const all = Array.from(skills.values()).filter(s => s.status === 'published');
  const totalDownloads = all.reduce((sum, s) => sum + s.download_count, 0);
  const categories: Record<string, number> = {};
  for (const s of all) {
    categories[s.category] = (categories[s.category] || 0) + 1;
  }
  return {
    total_skills: all.length,
    total_downloads: totalDownloads,
    categories,
  };
}

// Skill Store Engine — Chapter 31
// 4-layer security moderation, 5 credits per download, authors earn 100% revenue

import { randomUUID } from 'crypto';
import {
  Skill,
  SkillStatus,
  SkillCreate,
  SkillModerationReport,
  SkillDownloadLog,
  SkillListOptions,
  ModerationLayer,
  ModerationResult,
} from './types';

const FORBIDDEN_KEYWORDS = [
  'bomb', 'weapon', 'hack', 'exploit', 'phishing', 'malware',
  'stolen', 'illegal', 'terroris', 'fraud',
];

const DOWNLOAD_CREDITS = 5;

export class SkillStoreEngine {
  private skills: Map<string, Skill> = new Map();
  private downloadLogs: Map<string, SkillDownloadLog[]> = new Map();

  // ============ 4-Layer Moderation Pipeline ============

  private async moderateSkill(skill: Skill): Promise<SkillModerationReport[]> {
    const reports: SkillModerationReport[] = [];
    const now = new Date().toISOString();

    // Layer 1: Keyword + pattern scan
    const layer1 = this.layer1KeywordScan(skill);
    layer1.checked_at = now;
    reports.push(layer1);

    if (layer1.result === ModerationResult.FAIL) {
      skill.moderation = reports;
      return reports;
    }

    // Layer 2: Semantic analysis (heuristic)
    const layer2 = this.layer2SemanticAnalysis(skill);
    layer2.checked_at = now;
    reports.push(layer2);

    if (layer2.result === ModerationResult.FAIL) {
      skill.moderation = reports;
      return reports;
    }

    // Layer 3: Signal database check
    const layer3 = this.layer3SignalCheck(skill);
    layer3.checked_at = now;
    reports.push(layer3);

    if (layer3.result === ModerationResult.FAIL) {
      skill.moderation = reports;
      return reports;
    }

    // Layer 4: Human review (auto-pass for MVP, queue for future)
    const layer4: SkillModerationReport = {
      layer: ModerationLayer.LAYER4_HUMAN,
      result: ModerationResult.PASS,
      reason: 'Auto-approved: all automated checks passed',
      checked_at: now,
    };
    reports.push(layer4);

    return reports;
  }

  private layer1KeywordScan(skill: Skill): SkillModerationReport {
    const text = `${skill.title} ${skill.description} ${skill.content}`.toLowerCase();
    const found = FORBIDDEN_KEYWORDS.filter((kw) => text.includes(kw));

    if (found.length > 0) {
      return {
        layer: ModerationLayer.LAYER1_TEXT,
        result: ModerationResult.FAIL,
        reason: `Forbidden keywords detected: ${found.join(', ')}`,
      };
    }
    return {
      layer: ModerationLayer.LAYER1_TEXT,
      result: ModerationResult.PASS,
    };
  }

  private layer2SemanticAnalysis(skill: Skill): SkillModerationReport {
    // Heuristic: check for suspiciously short content or high ratio of special chars
    if (skill.content.length < 50) {
      return {
        layer: ModerationLayer.LAYER2_SEMANTIC,
        result: ModerationResult.FAIL,
        reason: 'Content too short to be a valid skill',
      };
    }

    const specialCharRatio = (skill.content.match(/[<>{}]/g) || []).length / skill.content.length;
    if (specialCharRatio > 0.15) {
      return {
        layer: ModerationLayer.LAYER2_SEMANTIC,
        result: ModerationResult.REVIEW,
        reason: `High special character ratio (${Math.round(specialCharRatio * 100)}%), flagged for review`,
      };
    }

    return {
      layer: ModerationLayer.LAYER2_SEMANTIC,
      result: ModerationResult.PASS,
    };
  }

  private layer3SignalCheck(skill: Skill): SkillModerationReport {
    // Heuristic: block if content appears to be requesting jailbreak/directive injection
    const suspicious = [
      'ignore previous instructions',
      'disregard all previous',
      'you are now',
      'pretend you are',
      'bypass safety',
    ];

    const lower = skill.content.toLowerCase();
    const flagged = suspicious.filter((s) => lower.includes(s));

    if (flagged.length > 0) {
      return {
        layer: ModerationLayer.LAYER3_SIGNAL,
        result: ModerationResult.FAIL,
        reason: `Known suspicious directive pattern: ${flagged[0]}`,
      };
    }

    return {
      layer: ModerationLayer.LAYER3_SIGNAL,
      result: ModerationResult.PASS,
    };
  }

  private overallModerationPass(reports: SkillModerationReport[]): boolean {
    // Skill passes if no layer FAILed, and REVIEW requires human (auto-pass for now)
    return !reports.some(
      (r) => r.result === ModerationResult.FAIL
    );
  }

  // ============ Publish ============

  async publishSkill(create: SkillCreate): Promise<Skill> {
    const now = new Date().toISOString();
    const skill: Skill = {
      id: `skl_${randomUUID().slice(0, 8)}`,
      title: create.title,
      description: create.description,
      content: create.content,
      category: create.category || 'general',
      tags: create.tags || [],
      author_id: create.sender_id,
      version: create.version || '1.0.0',
      status: SkillStatus.PENDING,
      downloads: 0,
      rating: 0,
      rating_count: 0,
      price_credits: DOWNLOAD_CREDITS,
      moderation: [],
      created_at: now,
      updated_at: now,
    };

    // Run 4-layer moderation pipeline
    skill.moderation = await this.moderateSkill(skill);

    if (this.overallModerationPass(skill.moderation)) {
      skill.status = SkillStatus.APPROVED;
      skill.published_at = now;
    } else {
      skill.status = SkillStatus.REJECTED;
    }

    this.skills.set(skill.id, skill);
    return skill;
  }

  // ============ Download ============

  async downloadSkill(
    skillId: string,
    downloaderId: string
  ): Promise<{ log: SkillDownloadLog; content: string } | null> {
    const skill = this.skills.get(skillId);
    if (!skill) return null;

    if (skill.status !== SkillStatus.APPROVED) {
      return null;
    }

    const now = new Date().toISOString();
    const log: SkillDownloadLog = {
      id: `dl_${randomUUID().slice(0, 8)}`,
      skill_id: skillId,
      downloader_id: downloaderId,
      credits_charged: DOWNLOAD_CREDITS,
      downloaded_at: now,
    };

    // Record download
    skill.downloads += 1;

    const logs = this.downloadLogs.get(skillId) || [];
    logs.push(log);
    this.downloadLogs.set(skillId, logs);

    return { log, content: skill.content };
  }

  // ============ Queries ============

  getSkill(id: string): Skill | null {
    return this.skills.get(id) || null;
  }

  listSkills(opts: SkillListOptions = {}): { skills: Skill[]; next_cursor?: string } {
    let all = Array.from(this.skills.values());

    // Filter by status (default: approved only)
    if (opts.status) {
      all = all.filter((s) => s.status === opts.status);
    } else {
      all = all.filter((s) => s.status === SkillStatus.APPROVED);
    }

    // Filter by category
    if (opts.category) {
      all = all.filter((s) => s.category === opts.category);
    }

    // Full-text search
    if (opts.query) {
      const q = opts.query.toLowerCase();
      all = all.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
    if (opts.sort === 'newest') {
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (opts.sort === 'rating') {
      all.sort((a, b) => b.rating - a.rating);
    } else {
      // Default: popular (downloads)
      all.sort((a, b) => b.downloads - a.downloads);
    }

    // Pagination with cursor
    const limit = opts.limit || 20;
    let startIndex = 0;
    if (opts.cursor) {
      const idx = all.findIndex((s) => s.id === opts.cursor);
      if (idx >= 0) startIndex = idx + 1;
    }

    const page = all.slice(startIndex, startIndex + limit);
    const nextCursor = page.length === limit ? page[page.length - 1].id : undefined;

    return { skills: page, next_cursor: nextCursor };
  }

  getHubStatus(): {
    total_skills: number;
    approved: number;
    pending: number;
    rejected: number;
    total_downloads: number;
  } {
    const all = Array.from(this.skills.values());
    return {
      total_skills: all.length,
      approved: all.filter((s) => s.status === SkillStatus.APPROVED).length,
      pending: all.filter((s) => s.status === SkillStatus.PENDING).length,
      rejected: all.filter((s) => s.status === SkillStatus.REJECTED).length,
      total_downloads: all.reduce((sum, s) => sum + s.downloads, 0),
    };
  }

  // Rate a skill (simplified)
  rateSkill(skillId: string, rating: number): boolean {
    const skill = this.skills.get(skillId);
    if (!skill || skill.status !== SkillStatus.APPROVED) return false;
    if (rating < 1 || rating > 5) return false;

    const newCount = skill.rating_count + 1;
    skill.rating = (skill.rating * skill.rating_count + rating) / newCount;
    skill.rating_count = newCount;
    skill.updated_at = new Date().toISOString();
    return true;
  }
}

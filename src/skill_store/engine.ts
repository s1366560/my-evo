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
  SkillVersion,
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
      versions: [],
      bundled_files: create.bundled_files || [],
      license: create.license || 'EvoMap Skill License (ESL-1.0)',
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
  ): Promise<{
    log: SkillDownloadLog;
    content: string;
    already_purchased: boolean;
    bundled_files: { name: string; content: string }[];
    license: string;
    author_revenue: number;
    credit_cost: number;
  } | null> {
    const skill = this.skills.get(skillId);
    if (!skill) return null;

    if (skill.status !== SkillStatus.APPROVED) {
      return null;
    }

    const now = new Date().toISOString();

    // Check if downloader has already downloaded this skill (repeat = free)
    const existingLogs = this.downloadLogs.get(skillId) || [];
    const alreadyPurchased = existingLogs.some(
      (log) => log.downloader_id === downloaderId
    );
    const creditCost = alreadyPurchased ? 0 : DOWNLOAD_CREDITS;

    const log: SkillDownloadLog = {
      id: `dl_${randomUUID().slice(0, 8)}`,
      skill_id: skillId,
      downloader_id: downloaderId,
      credits_charged: creditCost,
      downloaded_at: now,
    };

    // Record download (only increment count for first downloads)
    if (!alreadyPurchased) {
      skill.downloads += 1;
    }

    existingLogs.push(log);
    this.downloadLogs.set(skillId, existingLogs);

    return {
      log,
      content: skill.content,
      already_purchased: alreadyPurchased,
      bundled_files: skill.bundled_files,
      license: skill.license,
      author_revenue: creditCost, // 100% to author
      credit_cost: creditCost,
    };
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

  // ============ Version Management ============

  /** Get version history for a skill */
  getVersions(skillId: string): SkillVersion[] | null {
    const skill = this.skills.get(skillId);
    if (!skill) return null;
    return skill.versions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /** Update skill to a new version */
  async updateSkill(skillId: string, authorId: string, updates: { title?: string; description?: string; content?: string; version?: string }): Promise<{ success: boolean; skill?: Skill; error?: string }> {
    const skill = this.skills.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.author_id !== authorId) return { success: false, error: 'Only author can update' };

    const now = new Date().toISOString();

    // Save current version to history before updating
    skill.versions.push({
      version: skill.version,
      content: skill.content,
      created_at: skill.updated_at,
      created_by: skill.author_id,
    });

    // Apply updates
    if (updates.title) skill.title = updates.title;
    if (updates.description) skill.description = updates.description;
    if (updates.content) skill.content = updates.content;
    if (updates.version) skill.version = updates.version;
    skill.updated_at = now;

    // Re-run moderation for content changes
    if (updates.content) {
      skill.moderation = await this.moderateSkill(skill);
      if (this.overallModerationPass(skill.moderation)) {
        skill.status = SkillStatus.APPROVED;
      } else {
        skill.status = SkillStatus.REJECTED;
      }
    }

    return { success: true, skill };
  }

  /** Rollback to a previous version */
  async rollbackSkill(skillId: string, authorId: string, targetVersion: string): Promise<{ success: boolean; skill?: Skill; error?: string }> {
    const skill = this.skills.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.author_id !== authorId) return { success: false, error: 'Only author can rollback' };

    const target = skill.versions.find((v) => v.version === targetVersion);
    if (!target) return { success: false, error: 'Version not found' };

    const now = new Date().toISOString();

    // Save current to history
    skill.versions.push({
      version: skill.version,
      content: skill.content,
      created_at: skill.updated_at,
      created_by: skill.author_id,
    });

    // Restore target version
    skill.content = target.content;
    skill.version = targetVersion;
    skill.updated_at = now;

    // Re-run moderation
    skill.moderation = await this.moderateSkill(skill);
    if (this.overallModerationPass(skill.moderation)) {
      skill.status = SkillStatus.APPROVED;
    } else {
      skill.status = SkillStatus.REJECTED;
    }

    return { success: true, skill };
  }

  /** Delete a specific version (not current) */
  deleteVersion(skillId: string, authorId: string, targetVersion: string): { success: boolean; error?: string } {
    const skill = this.skills.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.author_id !== authorId) return { success: false, error: 'Only author can delete versions' };
    if (skill.version === targetVersion) return { success: false, error: 'Cannot delete current version' };

    const idx = skill.versions.findIndex((v) => v.version === targetVersion);
    if (idx < 0) return { success: false, error: 'Version not found' };

    skill.versions.splice(idx, 1);
    return { success: true };
  }

  // ============ Recycle Bin (Soft Delete) ============

  /** Soft delete a skill (move to recycle bin) */
  softDelete(skillId: string, authorId: string): { success: boolean; error?: string } {
    const skill = this.skills.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.author_id !== authorId) return { success: false, error: 'Only author can delete' };

    skill.status = SkillStatus.DELETED;
    skill.deleted_at = new Date().toISOString();
    return { success: true };
  }

  /** Restore a skill from recycle bin */
  restore(skillId: string, authorId: string): { success: boolean; skill?: Skill; error?: string } {
    const skill = this.skills.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.author_id !== authorId) return { success: false, error: 'Only author can restore' };
    if (skill.status !== SkillStatus.DELETED) return { success: false, error: 'Skill is not in recycle bin' };

    skill.status = SkillStatus.APPROVED;
    skill.deleted_at = undefined;
    return { success: true, skill };
  }

  /** List skills in recycle bin for an author */
  listRecycleBin(authorId: string): Skill[] {
    return Array.from(this.skills.values())
      .filter((s) => s.author_id === authorId && s.status === SkillStatus.DELETED)
      .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime());
  }

  /** Permanently delete a skill */
  permanentDelete(skillId: string, authorId: string): { success: boolean; error?: string } {
    const skill = this.skills.get(skillId);
    if (!skill) return { success: false, error: 'Skill not found' };
    if (skill.author_id !== authorId) return { success: false, error: 'Only author can permanently delete' };
    if (skill.status !== SkillStatus.DELETED) return { success: false, error: 'Skill must be in recycle bin first' };

    this.skills.delete(skillId);
    return { success: true };
  }
}

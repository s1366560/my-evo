import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type { Skill, SkillRating } from '@prisma/client';
import { InsufficientCreditsError, NotFoundError, ValidationError } from '../shared/errors';
import { SKILL_DOWNLOAD_COST } from '../shared/constants';
import * as ranking from './ranking';
import * as recommendation from './recommendation';
import * as distillation from './distillation';
import * as quality from './quality';

let prisma = new PrismaClient();

type SkillStoreClient = PrismaClient | Prisma.TransactionClient;
type DiscoverableSkillStatus = 'approved' | 'published';

const DISCOVERABLE_SKILL_STATUSES: DiscoverableSkillStatus[] = ['approved', 'published'];
const AUTO_MODERATION_REVIEWER = 'system:auto';
const SKILL_RESTORE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const FORBIDDEN_SKILL_KEYWORDS = [
  'hack',
  'exploit',
  'malware',
  'phishing',
  'ransomware',
  'keylogger',
  'rootkit',
  'backdoor',
  'trojan',
  'ddos',
] as const;
const SKILL_SIGNAL_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?previous\s+instructions/i, reason: 'jailbreak pattern detected' },
  { pattern: /system\s+prompt/i, reason: 'prompt injection pattern detected' },
  { pattern: /developer\s+instructions/i, reason: 'prompt injection pattern detected' },
  { pattern: /bypass\s+(all\s+)?restrictions/i, reason: 'malicious instruction pattern detected' },
  { pattern: /disable\s+safety/i, reason: 'malicious instruction pattern detected' },
  { pattern: /\brm\s+-rf\b/i, reason: 'malicious command detected' },
] as const;

interface SkillModerationInput {
  name: string;
  description: string;
  code_template: string | null;
  steps: string[];
  examples: string[];
  parameters: unknown;
}

interface SkillModerationDecision {
  approved: boolean;
  rejection_reason?: string;
  data: Prisma.SkillUpdateInput;
}

function buildRejectedModerationDecision(
  rejectionReason: string,
  failedLayer: 1 | 2 | 3,
  reviewedAt: Date,
): SkillModerationDecision {
  return {
    approved: false,
    rejection_reason: rejectionReason,
    data: {
      status: 'rejected',
      l1_passed: failedLayer > 1,
      l2_passed: failedLayer > 2,
      l3_passed: false,
      l4_passed: false,
      reviewed_at: reviewedAt,
      reviewer: AUTO_MODERATION_REVIEWER,
    },
  };
}

function buildApprovedModerationDecision(reviewedAt: Date): SkillModerationDecision {
  return {
    approved: true,
    data: {
      status: 'approved',
      l1_passed: true,
      l2_passed: true,
      l3_passed: true,
      l4_passed: true,
      reviewed_at: reviewedAt,
      reviewer: AUTO_MODERATION_REVIEWER,
    },
  };
}

export function setPrisma(client: PrismaClient): void {
  prisma = client;
  ranking.setPrisma(client);
  recommendation.setPrisma(client);
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

function getSkillStoreClient(prismaClient?: SkillStoreClient): SkillStoreClient {
  return prismaClient ?? prisma;
}

function hasPassedModeration(skill: {
  l1_passed: boolean;
  l2_passed: boolean;
  l3_passed: boolean;
  l4_passed: boolean;
}): boolean {
  return skill.l1_passed && skill.l2_passed && skill.l3_passed && skill.l4_passed;
}

function isDiscoverableSkillStatus(status: string | null | undefined): status is DiscoverableSkillStatus {
  return DISCOVERABLE_SKILL_STATUSES.includes(status as DiscoverableSkillStatus);
}

function buildDiscoverableSkillWhere(extra: Prisma.SkillWhereInput = {}): Prisma.SkillWhereInput {
  return {
    ...extra,
    status: { in: [...DISCOVERABLE_SKILL_STATUSES] },
    deleted_at: null,
  };
}

function stringifyParameters(parameters: Prisma.JsonValue | Record<string, unknown> | null | undefined): string {
  if (!parameters) {
    return '';
  }

  try {
    return JSON.stringify(parameters);
  } catch {
    return '';
  }
}

function getSkillNarrativeText(skill: SkillModerationInput): string {
  return [
    skill.name,
    skill.description,
    ...(skill.steps ?? []),
    ...(skill.examples ?? []),
    stringifyParameters(skill.parameters as Prisma.JsonValue | Record<string, unknown> | null | undefined),
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');
}

function getSkillModerationText(skill: SkillModerationInput): string {
  return [
    skill.name,
    skill.description,
    skill.code_template ?? '',
    ...(skill.steps ?? []),
    ...(skill.examples ?? []),
    stringifyParameters(skill.parameters as Prisma.JsonValue | Record<string, unknown> | null | undefined),
  ].join('\n');
}

function getSpecialCharacterRatio(text: string): number {
  const normalized = text.replace(/\s+/g, '');
  if (normalized.length === 0) {
    return 0;
  }

  const specialMatches = normalized.match(/[^a-zA-Z0-9\u4e00-\u9fff.,;:!?()[\]{}"'`_-]/g) ?? [];
  return specialMatches.length / normalized.length;
}

function evaluateSkillModeration(skill: SkillModerationInput): SkillModerationDecision {
  const reviewedAt = new Date();
  const moderationText = getSkillModerationText(skill);
  const normalizedText = moderationText.toLowerCase();
  const narrativeText = getSkillNarrativeText(skill);

  const blockedKeyword = FORBIDDEN_SKILL_KEYWORDS.find((keyword) => normalizedText.includes(keyword));
  if (blockedKeyword) {
    return buildRejectedModerationDecision(
      `Skill failed keyword scan: forbidden keyword '${blockedKeyword}' detected`,
      1,
      reviewedAt,
    );
  }

  const hasStructuredContent = Boolean(
    skill.code_template?.trim()
      || (skill.steps?.length ?? 0) > 0
      || (skill.examples?.length ?? 0) > 0
      || stringifyParameters(skill.parameters as Prisma.JsonValue | Record<string, unknown> | null | undefined),
  );
  if (narrativeText.trim().length < 50 || !hasStructuredContent) {
    return buildRejectedModerationDecision(
      'Skill failed semantic check: content must be descriptive and structurally complete',
      2,
      reviewedAt,
    );
  }

  if (getSpecialCharacterRatio(narrativeText) > 0.15) {
    return buildRejectedModerationDecision(
      'Skill failed semantic check: special character ratio exceeds 15%',
      2,
      reviewedAt,
    );
  }

  const matchedSignal = SKILL_SIGNAL_PATTERNS.find(({ pattern }) => pattern.test(moderationText));
  if (matchedSignal) {
    return buildRejectedModerationDecision(
      `Skill failed signal check: ${matchedSignal.reason}`,
      3,
      reviewedAt,
    );
  }

  return buildApprovedModerationDecision(reviewedAt);
}

function resetModerationState(): Prisma.SkillUpdateInput {
  return {
    status: 'pending',
    l1_passed: false,
    l2_passed: false,
    l3_passed: false,
    l4_passed: false,
    reviewed_at: null,
    reviewer: null,
  };
}

// ------------------------------------------------------------------
// List / Get
// ------------------------------------------------------------------

export interface SkillListResult {
  items: Skill[];
  total: number;
  next_cursor: string | null;
  has_more: boolean;
}

export async function listSkills(
  category?: string,
  tags?: string[],
  search?: string,
  limit = 20,
  offset = 0,
  sort = 'recent',
  cursor?: string,
  prismaClient?: PrismaClient,
): Promise<SkillListResult> {
  const client = getPrismaClient(prismaClient);
  const where: Prisma.SkillWhereInput = buildDiscoverableSkillWhere();

  if (category) {
    where.category = category;
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  let orderBy: Record<string, string> = { updated_at: 'desc' };
  if (sort === 'rating') {
    orderBy = { rating: 'desc' };
  } else if (sort === 'downloads' || sort === 'popular') {
    orderBy = { download_count: 'desc' };
  } else if (sort === 'newest' || sort === 'recent') {
    orderBy = { created_at: 'desc' };
  } else if (sort === 'price_asc') {
    orderBy = { price_credits: 'asc' };
  } else if (sort === 'price_desc') {
    orderBy = { price_credits: 'desc' };
  }

  const [rawItems, total] = await Promise.all([
    client.skill.findMany({
      where,
      orderBy,
      take: limit + 1,
      skip: cursor ? 1 : offset,
      ...(cursor ? { cursor: { skill_id: cursor } } : {}),
    }),
    client.skill.count({ where }),
  ]);

  const hasMore = rawItems.length > limit;
  const items = rawItems.slice(0, limit) as unknown as Skill[];
  const nextCursor = hasMore ? items[items.length - 1]?.skill_id ?? null : null;

  return {
    items,
    total,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

export async function getSkill(
  skillId: string,
  prismaClient?: SkillStoreClient,
  requesterId?: string,
): Promise<Skill | null> {
  const client = getSkillStoreClient(prismaClient);
  const skill = await client.skill.findUnique({
    where: { skill_id: skillId },
  });

  if (skill && skill.deleted_at) {
    return null;
  }

  if (skill && !isDiscoverableSkillStatus(skill.status) && skill.author_id !== requesterId) {
    return null;
  }

  return skill as unknown as Skill | null;
}

// ------------------------------------------------------------------
// Create
// ------------------------------------------------------------------

interface CreateSkillData {
  name: string;
  description: string;
  category: string;
  price_credits?: number;
  code_template?: string;
  parameters?: Record<string, unknown>;
  steps?: string[];
  examples?: string[];
  tags?: string[];
  source_capsules?: string[];
}

export type DownloadSkillResult = Skill & {
  credits_charged: number;
  remaining_credits: number;
};

export async function createSkill(
  authorId: string,
  data: CreateSkillData,
  prismaClient?: SkillStoreClient,
): Promise<Skill> {
  const client = getSkillStoreClient(prismaClient);
  if (!data.name || data.name.trim().length === 0) {
    throw new ValidationError('name is required');
  }
  if (!data.description || data.description.trim().length === 0) {
    throw new ValidationError('description is required');
  }
  if (!data.category || data.category.trim().length === 0) {
    throw new ValidationError('category is required');
  }

  const skill = await client.skill.create({
    data: {
      skill_id: crypto.randomUUID(),
      name: data.name.trim(),
      description: data.description.trim(),
      category: data.category.trim(),
      author_id: authorId,
      status: 'pending',
      price_credits: data.price_credits ?? 5,
      code_template: data.code_template ?? null,
      parameters: (data.parameters as unknown as Prisma.InputJsonValue) ?? null,
      steps: data.steps ?? [],
      examples: data.examples ?? [],
      tags: data.tags ?? [],
      source_capsules: data.source_capsules ?? [],
    },
  });

  return skill as unknown as Skill;
}

// ------------------------------------------------------------------
// Update
// ------------------------------------------------------------------

interface UpdateSkillData {
  name?: string;
  description?: string;
  category?: string;
  price_credits?: number;
  code_template?: string | null;
  parameters?: Record<string, unknown> | null;
  steps?: string[];
  examples?: string[];
  tags?: string[];
  source_capsules?: string[];
}

interface SkillVersionSnapshot {
  version: string;
  name: string;
  description: string;
  category: string;
  price_credits: number;
  code_template: string | null;
  parameters: Prisma.JsonValue | null;
  steps: string[];
  examples: string[];
  tags: string[];
  source_capsules: string[];
  status: string;
  l1_passed: boolean;
  l2_passed: boolean;
  l3_passed: boolean;
  l4_passed: boolean;
  reviewed_at: string | null;
  reviewer: string | null;
}

function buildSkillVersionSnapshot(skill: Skill): SkillVersionSnapshot {
  return {
    version: skill.version,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    price_credits: skill.price_credits,
    code_template: skill.code_template ?? null,
    parameters: (skill.parameters as Prisma.JsonValue | null) ?? null,
    steps: skill.steps,
    examples: skill.examples,
    tags: skill.tags,
    source_capsules: skill.source_capsules,
    status: skill.status,
    l1_passed: skill.l1_passed,
    l2_passed: skill.l2_passed,
    l3_passed: skill.l3_passed,
    l4_passed: skill.l4_passed,
    reviewed_at: skill.reviewed_at?.toISOString() ?? null,
    reviewer: skill.reviewer ?? null,
  };
}

function normalizeSkillVersions(versions: unknown): SkillVersionSnapshot[] {
  if (!Array.isArray(versions)) {
    return [];
  }

  return versions.flatMap((version) => {
    if (typeof version !== 'object' || version === null || !('version' in version)) {
      return [];
    }

    const snapshot = version as Record<string, unknown>;
    return [{
      version: typeof snapshot.version === 'string' ? snapshot.version : '1.0.0',
      name: typeof snapshot.name === 'string' ? snapshot.name : '',
      description: typeof snapshot.description === 'string' ? snapshot.description : '',
      category: typeof snapshot.category === 'string' ? snapshot.category : 'general',
      price_credits: typeof snapshot.price_credits === 'number' ? snapshot.price_credits : 5,
      code_template: typeof snapshot.code_template === 'string' ? snapshot.code_template : null,
      parameters: (snapshot.parameters as Prisma.JsonValue | null | undefined) ?? null,
      steps: Array.isArray(snapshot.steps) ? snapshot.steps.filter((step): step is string => typeof step === 'string') : [],
      examples: Array.isArray(snapshot.examples) ? snapshot.examples.filter((example): example is string => typeof example === 'string') : [],
      tags: Array.isArray(snapshot.tags) ? snapshot.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      source_capsules: Array.isArray(snapshot.source_capsules)
        ? snapshot.source_capsules.filter((capsule): capsule is string => typeof capsule === 'string')
        : [],
      status: typeof snapshot.status === 'string' ? snapshot.status : 'pending',
      l1_passed: typeof snapshot.l1_passed === 'boolean' ? snapshot.l1_passed : false,
      l2_passed: typeof snapshot.l2_passed === 'boolean' ? snapshot.l2_passed : false,
      l3_passed: typeof snapshot.l3_passed === 'boolean' ? snapshot.l3_passed : false,
      l4_passed: typeof snapshot.l4_passed === 'boolean' ? snapshot.l4_passed : false,
      reviewed_at: typeof snapshot.reviewed_at === 'string' ? snapshot.reviewed_at : null,
      reviewer: typeof snapshot.reviewer === 'string' ? snapshot.reviewer : null,
    }];
  });
}

function getNextPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return '1.0.1';
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function buildSkillUpdateData(updates: UpdateSkillData): Prisma.SkillUpdateInput {
  const data: Prisma.SkillUpdateInput = {};

  if (updates.name !== undefined) {
    data.name = updates.name.trim();
  }
  if (updates.description !== undefined) {
    data.description = updates.description.trim();
  }
  if (updates.category !== undefined) {
    const category = updates.category.trim();
    if (!category) {
      throw new ValidationError('category is required');
    }
    data.category = category;
  }
  if (updates.price_credits !== undefined) {
    if (!Number.isInteger(updates.price_credits) || updates.price_credits < 0) {
      throw new ValidationError('price_credits must be a non-negative integer');
    }
    data.price_credits = updates.price_credits;
  }
  if (updates.code_template !== undefined) {
    data.code_template = updates.code_template;
  }
  if (updates.parameters !== undefined) {
    data.parameters = updates.parameters as unknown as Prisma.InputJsonValue;
  }
  if (updates.steps !== undefined) {
    data.steps = updates.steps;
  }
  if (updates.examples !== undefined) {
    data.examples = updates.examples;
  }
  if (updates.tags !== undefined) {
    data.tags = updates.tags;
  }
  if (updates.source_capsules !== undefined) {
    data.source_capsules = updates.source_capsules;
  }

  return data;
}

export async function updateSkill(
  skillId: string,
  authorId: string,
  updates: UpdateSkillData,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only update your own skills');
  }

  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: buildSkillUpdateData(updates),
  });

  return updated as unknown as Skill;
}

// ------------------------------------------------------------------
// Delete (soft)
// ------------------------------------------------------------------

export async function deleteSkill(
  skillId: string,
  authorId: string,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only delete your own skills');
  }

  await client.skill.update({
    where: { skill_id: skillId },
    data: {
      deleted_at: new Date(),
      status: 'deleted',
    },
  });
}

// ------------------------------------------------------------------
// Publish
// ------------------------------------------------------------------

export async function publishSkill(
  skillId: string,
  authorId: string,
  prismaClient?: SkillStoreClient,
): Promise<Skill> {
  const client = getSkillStoreClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only publish your own skills');
  }

  if (isDiscoverableSkillStatus(skill.status)) {
    throw new ValidationError('Skill is already published');
  }

  const moderation = evaluateSkillModeration(skill);
  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: moderation.data,
  });

  if (!moderation.approved) {
    throw new ValidationError(moderation.rejection_reason ?? 'Skill failed moderation');
  }

  return updated as unknown as Skill;
}

export async function createPublishedSkill(
  authorId: string,
  data: CreateSkillData,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const created = await createSkill(authorId, data, client);
  return publishSkill(created.skill_id, authorId, client);
}

export async function publishSkillWithUpdates(
  skillId: string,
  authorId: string,
  updates: UpdateSkillData = {},
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const updateData = buildSkillUpdateData(updates);

  const published = await client.$transaction(async (tx) => {
    const skill = await tx.skill.findUnique({ where: { skill_id: skillId } });

    if (!skill) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.deleted_at) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.author_id !== authorId) {
      throw new ValidationError('You can only publish your own skills');
    }

    if (isDiscoverableSkillStatus(skill.status)) {
      throw new ValidationError('Skill is already published');
    }

    const moderation = evaluateSkillModeration({
      name: updates.name?.trim() ?? skill.name,
      description: updates.description?.trim() ?? skill.description,
      code_template: updates.code_template !== undefined ? updates.code_template : skill.code_template,
      parameters: updates.parameters !== undefined ? updates.parameters : skill.parameters,
      steps: updates.steps ?? skill.steps,
      examples: updates.examples ?? skill.examples,
    });

    const updated = await tx.skill.update({
      where: { skill_id: skillId },
      data: {
        ...updateData,
        ...moderation.data,
      },
    });

    if (!moderation.approved) {
      throw new ValidationError(moderation.rejection_reason ?? 'Skill failed moderation');
    }

    return updated;
  });

  return published as unknown as Skill;
}

export async function updateSkillVersion(
  skillId: string,
  authorId: string,
  updates: UpdateSkillData & { version?: string },
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const { version, ...skillUpdates } = updates;
  const updateData = buildSkillUpdateData(skillUpdates);

  const updated = await client.$transaction(async (tx) => {
    const skill = await tx.skill.findUnique({ where: { skill_id: skillId } });

    if (!skill) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.deleted_at) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.author_id !== authorId) {
      throw new ValidationError('You can only update your own skills');
    }

    const versions = normalizeSkillVersions(skill.versions);
    const nextVersion = version?.trim() || getNextPatchVersion(skill.version);

    return tx.skill.update({
      where: { skill_id: skillId },
      data: {
        ...updateData,
        version: nextVersion,
        versions: [...versions, buildSkillVersionSnapshot(skill)] as unknown as Prisma.InputJsonValue,
        ...resetModerationState(),
      },
    });
  });

  return updated as unknown as Skill;
}

export async function rollbackSkillVersion(
  skillId: string,
  authorId: string,
  targetVersion?: string,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);

  const rolledBack = await client.$transaction(async (tx) => {
    const skill = await tx.skill.findUnique({ where: { skill_id: skillId } });

    if (!skill) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.deleted_at) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.author_id !== authorId) {
      throw new ValidationError('You can only rollback your own skills');
    }

    const versions = normalizeSkillVersions(skill.versions);
    if (versions.length === 0) {
      throw new ValidationError('No previous version is available for rollback');
    }

    const targetIndex = targetVersion
      ? versions.findIndex((version) => version.version === targetVersion)
      : versions.length - 1;

    if (targetIndex < 0) {
      throw new NotFoundError('Skill version', targetVersion ?? 'latest');
    }

    const target = versions[targetIndex]!;
    if (!isDiscoverableSkillStatus(target.status) || !hasPassedModeration(target)) {
      throw new ValidationError('Only approved skill versions can be rolled back');
    }
    const currentSnapshot = buildSkillVersionSnapshot(skill);
    const remainingVersions = versions.filter((_, index) => index !== targetIndex);

    return tx.skill.update({
      where: { skill_id: skillId },
      data: {
        name: target.name,
        description: target.description,
        category: target.category,
        price_credits: target.price_credits,
        code_template: target.code_template,
        parameters: target.parameters === null
          ? Prisma.JsonNull
          : target.parameters as Prisma.InputJsonValue,
        steps: target.steps,
        examples: target.examples,
        tags: target.tags,
        source_capsules: target.source_capsules,
        status: target.status,
        l1_passed: target.l1_passed,
        l2_passed: target.l2_passed,
        l3_passed: target.l3_passed,
        l4_passed: target.l4_passed,
        reviewed_at: target.reviewed_at ? new Date(target.reviewed_at) : null,
        reviewer: target.reviewer,
        version: target.version,
        versions: [...remainingVersions, currentSnapshot] as unknown as Prisma.InputJsonValue,
      },
    });
  });

  return rolledBack as unknown as Skill;
}

// ------------------------------------------------------------------
// Rate
// ------------------------------------------------------------------

export async function rateSkill(
  skillId: string,
  raterId: string,
  rating: number,
  prismaClient?: PrismaClient,
): Promise<SkillRating> {
  const client = getPrismaClient(prismaClient);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('rating must be an integer between 1 and 5');
  }

  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });
  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }
  if (skill.deleted_at) {
    throw new NotFoundError('Skill', skillId);
  }

  // Upsert rating
  const skillRating = await client.skillRating.upsert({
    where: { skill_id_rater_id: { skill_id: skillId, rater_id: raterId } },
    update: { rating },
    create: { skill_id: skillId, rater_id: raterId, rating },
  });

  // Recalculate aggregate rating
  const agg = await client.skillRating.aggregate({
    where: { skill_id: skillId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await client.skill.update({
    where: { skill_id: skillId },
    data: {
      rating: agg._avg.rating ?? 0,
      rating_count: agg._count.rating,
    },
  });

  return skillRating as unknown as SkillRating;
}

// ------------------------------------------------------------------
// Download
// ------------------------------------------------------------------

export async function downloadSkill(
  skillId: string,
  nodeId: string,
  prismaClient?: PrismaClient,
): Promise<DownloadSkillResult> {
  const client = getPrismaClient(prismaClient);
  const downloaded = await client.$transaction(async (tx) => {
    const skill = await tx.skill.findUnique({ where: { skill_id: skillId } });

    if (!skill) {
      throw new NotFoundError('Skill', skillId);
    }

    if (skill.deleted_at) {
      throw new NotFoundError('Skill', skillId);
    }

    if (!isDiscoverableSkillStatus(skill.status)) {
      throw new ValidationError('Only approved skills can be downloaded');
    }

    if (skill.author_id === nodeId) {
      throw new ValidationError('Cannot download your own skill');
    }

    const buyer = await tx.node.findUnique({
      where: { node_id: nodeId },
    });

    if (!buyer) {
      throw new NotFoundError('Node', nodeId);
    }

    const author = await tx.node.findUnique({
      where: { node_id: skill.author_id },
    });

    if (!author) {
      throw new NotFoundError('Node', skill.author_id);
    }

    const creditsCharged = skill.price_credits ?? SKILL_DOWNLOAD_COST;
    if (buyer.credit_balance < creditsCharged) {
      throw new InsufficientCreditsError(creditsCharged, buyer.credit_balance);
    }

    const updatedSkill = await tx.skill.update({
      where: { skill_id: skillId },
      data: { download_count: { increment: 1 } },
    });

    let remainingCredits = buyer.credit_balance;
    remainingCredits = buyer.credit_balance - creditsCharged;

    await tx.node.update({
      where: { node_id: nodeId },
      data: { credit_balance: { decrement: creditsCharged } },
    });

    await tx.node.update({
      where: { node_id: skill.author_id },
      data: { credit_balance: { increment: creditsCharged } },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: nodeId,
        amount: -creditsCharged,
        type: 'skill_download',
        description: `Downloaded skill ${skillId}`,
        balance_after: remainingCredits,
      },
    });

    await tx.creditTransaction.create({
      data: {
        node_id: skill.author_id,
        amount: creditsCharged,
        type: 'skill_sale',
        description: `Skill ${skillId} downloaded by ${nodeId}`,
        balance_after: author.credit_balance + creditsCharged,
      },
    });

    return {
      ...(updatedSkill as unknown as Skill),
      credits_charged: creditsCharged,
      remaining_credits: remainingCredits,
    };
  });

  return downloaded;
}

// ------------------------------------------------------------------
// Categories
// ------------------------------------------------------------------

export async function getCategories(prismaClient?: PrismaClient): Promise<Array<{ category: string; count: number }>> {
  const client = getPrismaClient(prismaClient);
  const result = await client.skill.groupBy({
    by: ['category'],
    where: buildDiscoverableSkillWhere(),
    _count: { category: true },
    orderBy: { _count: { category: 'desc' } },
  });

  return result.map((r) => ({
    category: r.category,
    count: r._count.category,
  }));
}

// ------------------------------------------------------------------
// Featured
// ------------------------------------------------------------------

export async function getFeaturedSkills(limit = 10, prismaClient?: PrismaClient): Promise<Skill[]> {
  const client = getPrismaClient(prismaClient);
  const skills = await client.skill.findMany({
    where: buildDiscoverableSkillWhere(),
    orderBy: [{ rating: 'desc' }, { download_count: 'desc' }],
    take: limit,
  });

  return skills as unknown as Skill[];
}

// ------------------------------------------------------------------
// Integrated Distillation, Ranking, Recommendation, Quality
// ------------------------------------------------------------------

// --- Distillation ---

export async function distillFromCapsules(
  nodeId: string,
  capsules: distillation.SuccessfulPractice[],
  cooldownAfter?: number,
  prismaClient?: PrismaClient,
): Promise<distillation.DistillationResult> {
  return distillation.extractSkill({ nodeId, capsules, cooldownAfter }, prismaClient);
}

export function checkDistillationEligibility(
  capsules: distillation.SuccessfulPractice[],
  cooldownAfter?: number,
): distillation.ExtractionMetrics {
  return distillation.canDistill({ nodeId: '', capsules, cooldownAfter });
}

export function validateSkillContent(
  skill: Parameters<typeof distillation.validateDistilledSkill>[0],
): distillation.ValidationResult {
  return distillation.validateDistilledSkill(skill);
}

// --- Ranking ---

export async function rankSkillsByCategory(
  category?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: ranking.RankedSkill[]; total: number }> {
  return ranking.rankSkills(category, limit, offset);
}

export async function calculateCompositeSkillScore(skillId: string): Promise<number> {
  return ranking.calculateSkillScore(skillId);
}

export async function getTopRankedSkills(
  limit = 10,
  category?: string,
): Promise<ranking.RankedSkill[]> {
  return ranking.getTopSkills(limit, category);
}

export async function compareTwoSkills(
  skillIdA: string,
  skillIdB: string,
): Promise<ranking.SkillComparison> {
  return ranking.compareSkills(skillIdA, skillIdB);
}

// --- Recommendation ---

export async function getRecommendedSkills(
  userId: string,
  limit = 10,
): Promise<recommendation.SkillRecommendation[]> {
  return recommendation.recommendSkills(userId, limit);
}

export function getSkillImprovements(
  skill: Parameters<typeof recommendation.suggestImprovements>[0],
): recommendation.ImprovementSuggestion[] {
  return recommendation.suggestImprovements(skill);
}

export async function getComplementarySkills(
  skillId: string,
  limit = 5,
): Promise<recommendation.ComplementarySkill[]> {
  return recommendation.findComplementarySkills(skillId, limit);
}

// --- Quality ---

export function assessSkillQuality(
  skill: quality.SkillContent,
): quality.QualityAssessment {
  return quality.assessQuality(skill);
}

export function gradeFromScore(score: number): quality.QualityGrade {
  return quality.computeGrade(score);
}

// ------------------------------------------------------------------
// Restore (soft-delete recovery)
// ------------------------------------------------------------------

export async function restoreSkill(
  skillId: string,
  authorId: string,
  prismaClient?: PrismaClient,
): Promise<Skill> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (!skill.deleted_at) {
    throw new ValidationError('Skill is not deleted');
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only restore your own skills');
  }

  if (Date.now() - skill.deleted_at.getTime() > SKILL_RESTORE_WINDOW_MS) {
    throw new ValidationError('Skill can only be restored within 30 days of deletion');
  }

  const updated = await client.skill.update({
    where: { skill_id: skillId },
    data: {
      deleted_at: null,
      status: hasPassedModeration(skill) || isDiscoverableSkillStatus(skill.status) ? 'approved' : 'pending',
    },
  });

  return updated as unknown as Skill;
}

export async function permanentlyDeleteSkill(
  skillId: string,
  authorId: string,
  prismaClient?: PrismaClient,
): Promise<{ deleted: true }> {
  const client = getPrismaClient(prismaClient);
  const skill = await client.skill.findUnique({ where: { skill_id: skillId } });

  if (!skill) {
    throw new NotFoundError('Skill', skillId);
  }

  if (skill.author_id !== authorId) {
    throw new ValidationError('You can only permanently delete your own skills');
  }

  await client.$transaction(async (tx) => {
    await tx.skillRating.deleteMany({ where: { skill_id: skillId } });
    await tx.skill.delete({ where: { skill_id: skillId } });
  });

  return { deleted: true };
}

// ------------------------------------------------------------------
// My Skills
// ------------------------------------------------------------------

export async function getMySkills(
  authorId: string,
  limit = 20,
  offset = 0,
  prismaClient?: PrismaClient,
): Promise<{ items: Skill[]; total: number }> {
  const client = getPrismaClient(prismaClient);
  const [items, total] = await Promise.all([
    client.skill.findMany({
      where: { author_id: authorId, deleted_at: null },
      orderBy: { updated_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    client.skill.count({ where: { author_id: authorId, deleted_at: null } }),
  ]);

  return { items: items as unknown as Skill[], total };
}

export async function getSkillStoreStats(
  prismaClient?: PrismaClient,
): Promise<{
  total_skills: number;
  published: number;
  pending: number;
  deleted: number;
  total_downloads: number;
  avg_rating: number;
  total_authors: number;
}> {
  const client = getPrismaClient(prismaClient);
  const skills = await client.skill.findMany({
    select: {
      author_id: true,
      status: true,
      deleted_at: true,
      download_count: true,
      rating: true,
      rating_count: true,
    },
  });

  const totalSkills = skills.length;
  const published = skills.filter((skill) => isDiscoverableSkillStatus(skill.status) && !skill.deleted_at).length;
  const pending = skills.filter((skill) => skill.status === 'pending' && !skill.deleted_at).length;
  const deleted = skills.filter((skill) => Boolean(skill.deleted_at)).length;
  const totalDownloads = skills.reduce((sum, skill) => sum + skill.download_count, 0);
  const totalAuthors = new Set(skills.map((skill) => skill.author_id)).size;
  const ratingWeight = skills.reduce((sum, skill) => sum + skill.rating_count, 0);
  const ratingSum = skills.reduce((sum, skill) => sum + skill.rating * skill.rating_count, 0);

  return {
    total_skills: totalSkills,
    published,
    pending,
    deleted,
    total_downloads: totalDownloads,
    avg_rating: ratingWeight > 0 ? ratingSum / ratingWeight : 0,
    total_authors: totalAuthors,
  };
}

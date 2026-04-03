import { PrismaClient, Prisma } from '@prisma/client';
import crypto from 'crypto';
import type { Guild, GuildMember } from '../shared/types';
import type { NoveltyScore } from './types';
import { GUILD_MAX_MEMBERS } from '../shared/constants';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from '../shared/errors';

let prisma = new PrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function toGuild(record: Record<string, unknown>): Guild {
  return {
    guild_id: record.guild_id as string,
    name: record.name as string,
    description: record.description as string,
    creator_id: record.creator_id as string,
    member_count: record.member_count as number,
    total_genes: record.total_genes as number,
    total_capsules: record.total_capsules as number,
    novelty_score: record.novelty_score as number,
    status: record.status as Guild['status'],
    created_at: (record.created_at as Date).toISOString(),
  };
}

export async function createGuild(
  creatorId: string,
  name: string,
  description: string,
): Promise<Guild> {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Guild name is required');
  }

  const existing = await prisma.guild.findFirst({
    where: { name },
  });

  if (existing) {
    throw new ValidationError('Guild name already exists');
  }

  const guildId = crypto.randomUUID();
  const creatorMember: GuildMember = {
    node_id: creatorId,
    joined_at: new Date().toISOString(),
    contribution_score: 0,
    genes_published: 0,
    capsules_published: 0,
  };

  const guild = await prisma.guild.create({
    data: {
      guild_id: guildId,
      name,
      description,
      creator_id: creatorId,
      member_count: 1,
      members: [creatorMember] as unknown as Prisma.InputJsonValue,
      status: 'active',
    },
  });

  return toGuild(guild as unknown as Record<string, unknown>);
}

export async function joinGuild(
  guildId: string,
  nodeId: string,
): Promise<Guild> {
  const guild = await prisma.guild.findUnique({
    where: { guild_id: guildId },
  });

  if (!guild) {
    throw new NotFoundError('Guild', guildId);
  }

  if (guild.status !== 'active') {
    throw new ValidationError('Guild is not active');
  }

  const members = (guild.members as unknown as GuildMember[]) ?? [];

  const alreadyMember = members.some((m) => m.node_id === nodeId);
  if (alreadyMember) {
    throw new ValidationError('Already a member of this guild');
  }

  if (members.length >= GUILD_MAX_MEMBERS) {
    throw new ValidationError(
      `Guild has reached the maximum of ${GUILD_MAX_MEMBERS} members`,
    );
  }

  const newMember: GuildMember = {
    node_id: nodeId,
    joined_at: new Date().toISOString(),
    contribution_score: 0,
    genes_published: 0,
    capsules_published: 0,
  };

  const updatedMembers = [...members, newMember];

  const updated = await prisma.guild.update({
    where: { guild_id: guildId },
    data: {
      members: updatedMembers as unknown as Prisma.InputJsonValue,
      member_count: updatedMembers.length,
    },
  });

  return toGuild(updated as unknown as Record<string, unknown>);
}

export async function leaveGuild(
  guildId: string,
  nodeId: string,
): Promise<Guild> {
  const guild = await prisma.guild.findUnique({
    where: { guild_id: guildId },
  });

  if (!guild) {
    throw new NotFoundError('Guild', guildId);
  }

  if (guild.creator_id === nodeId) {
    throw new ValidationError('Creator cannot leave the guild');
  }

  const members = (guild.members as unknown as GuildMember[]) ?? [];
  const filtered = members.filter((m) => m.node_id !== nodeId);

  if (filtered.length === members.length) {
    throw new ValidationError('Not a member of this guild');
  }

  const updated = await prisma.guild.update({
    where: { guild_id: guildId },
    data: {
      members: filtered as unknown as Prisma.InputJsonValue,
      member_count: filtered.length,
    },
  });

  return toGuild(updated as unknown as Record<string, unknown>);
}

export async function getGuild(guildId: string): Promise<Guild | null> {
  const guild = await prisma.guild.findUnique({
    where: { guild_id: guildId },
  });

  if (!guild) {
    return null;
  }

  return toGuild(guild as unknown as Record<string, unknown>);
}

export async function listGuilds(
  limit = 20,
  offset = 0,
): Promise<{ items: Guild[]; total: number }> {
  const [guilds, total] = await Promise.all([
    prisma.guild.findMany({
      where: { status: 'active' },
      orderBy: { member_count: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guild.count({ where: { status: 'active' } }),
  ]);

  return {
    items: guilds.map((g: Record<string, unknown>) =>
      toGuild(g),
    ),
    total,
  };
}

export async function getNoveltyScore(
  nodeId: string,
): Promise<NoveltyScore> {
  const assets = await prisma.asset.findMany({
    where: { author_id: nodeId, status: 'published' },
    select: { signals: true },
  });

  const allSignals = await prisma.asset.findMany({
    where: { status: 'published' },
    select: { signals: true },
    take: 500,
  });

  const nodeSignals = new Set<string>(
    assets.flatMap((a: { signals: string[] }) => a.signals),
  );

  const globalSignalFreq: Record<string, number> = {};
  for (const a of allSignals) {
    for (const s of a.signals as string[]) {
      globalSignalFreq[s] = (globalSignalFreq[s] ?? 0) + 1;
    }
  }

  const totalGlobal = Object.values(globalSignalFreq).reduce(
    (a: number, b: number) => a + b,
    0,
  );

  let rareCount = 0;
  for (const signal of nodeSignals) {
    const freq = (globalSignalFreq[signal] ?? 0) / Math.max(totalGlobal, 1);
    if (freq < 0.05) {
      rareCount += 1;
    }
  }

  const totalSignals = nodeSignals.size;
  const uniquenessRatio =
    totalSignals > 0 ? rareCount / totalSignals : 0;

  const score = Math.min(
    100,
    Math.round(uniquenessRatio * 100 + rareCount * 10),
  );

  return {
    node_id: nodeId,
    score,
    unique_signals: totalSignals,
    total_signals: assets.flatMap((a: { signals: string[] }) => a.signals).length,
    rare_signal_count: rareCount,
  };
}

export async function getGlobalLeaderboard(
  limit = 20,
  offset = 0,
): Promise<{ items: Array<{ rank: number; node_id: string; reputation: number; contribution_score: number }>; total: number }> {
  const [nodes, total] = await Promise.all([
    prisma.node.findMany({
      orderBy: { reputation: 'desc' },
      take: limit,
      skip: offset,
      select: { node_id: true, reputation: true },
    }),
    prisma.node.count(),
  ]);

  const items = nodes.map((n, i) => ({
    rank: offset + i + 1,
    node_id: n.node_id,
    reputation: n.reputation,
    contribution_score: 0,
  }));

  return { items, total };
}
